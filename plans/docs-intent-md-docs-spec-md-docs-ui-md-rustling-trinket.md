# AuthStack の分離 (UserPool / UserPoolClient)

## Context

`docs/state.md` の "In Progress" は Backend Lambda resource provisioning であり、
最終的には Lambda + API Gateway + Cognito Authorizer + CloudFront `/api/*` ルーティング
までを実装する必要がある。

しかし現状の CDK 構成では以下の循環依存が潜在している:

- `DistributionStack` → 将来 `BackendStack` (API Gateway) をオリジンとして参照
- `BackendStack` → `AuthStack` の UserPool を Authorizer に参照
- `AuthStack` → `DistributionStack` の domain name を callback URL に参照 (現状)

この循環は `AuthStack` 内で UserPool 自体 (Distribution 非依存) と UserPoolClient
(Distribution callback URL に依存) が同居していることに起因する。

今回は BackendStack の追加に先立ち、`AuthStack` を以下の方針で分離する:

- **UserPool / Google IDP / Cognito Domain**: Distribution に依存しないリソース → `AuthStack` に残す
- **UserPoolClient**: Distribution の callback URL に依存する関連付け → 新規 `AuthClientStack` に切り出す

これは memory に記録されている「リソース作成と関連付けを別 construct (本件ではスタック)
に分離する」設計方針と一致する。

なお、 BackendStack 追加・CloudFront `/api/*` 統合・既存の CloudFront-S3 関連付け分離
(`docs/state.md` の Planned 項目) は、今回の作業範囲には含めない。

## ファイル構成

### 新規作成

- `infra/cdk/src/stacks/auth-client-stack.ts`
  - `AuthClientStack` を定義 (UserPoolClient のみを作成する関連付けスタック)

### 変更

- `infra/cdk/src/stacks/auth-stack.ts`
  - `UserPoolClient` の作成 (`addClient`) と関連 props (`distributionDomainName`)、
    関連 CfnOutput (`UserPoolClientId`)、 Google IDP への `addDependency` を削除
  - 公開フィールドから `userPoolClient` を削除
  - `googleIdp` を `public readonly` で公開する (新スタックから依存付け可能にするため)

- `infra/cdk/src/main.ts`
  - `AuthStack` インスタンス化時の props から `distributionDomainName` を削除
  - `AuthClientStack` を `AuthStack` と `DistributionStack` の後にインスタンス化
    - props: `userPool`, `googleIdp`, `distributionDomainName`

## 各ファイルの詳細

### `infra/cdk/src/stacks/auth-client-stack.ts` (新規)

`AuthClientStack` の役割:

- 既存 `AuthStack` の `userPool.addClient("WebClient", { ... })` のロジックを丸ごと
  移動する。 `cognito.UserPoolClient` の生成方法は `addClient` のままで構わない
  (引数として `userPool` を受け取って `userPool.addClient(...)` を呼び出す形)
- callback / logout URLs:
  - `https://${props.distributionDomainName}/`
  - `http://localhost:5173/`
- `supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE]`
- `oAuth.flows.authorizationCodeGrant: true`
- `oAuth.scopes`: OPENID, EMAIL, PROFILE
- `generateSecret: false`
- 生成した client に対し `client.node.addDependency(props.googleIdp)` を維持
  (Google IDP が先に作られないと client 作成時にエラーになる Cognito の制約)
- `public readonly userPoolClient: cognito.UserPoolClient`
- `CfnOutput "UserPoolClientId"` を出力 (旧 AuthStack の出力を引き継ぐ)

props:

```ts
interface AuthClientStackProps extends StackProps {
  userPool: cognito.IUserPool;
  googleIdp: cognito.UserPoolIdentityProviderGoogle;
  distributionDomainName: string;
}
```

### `infra/cdk/src/stacks/auth-stack.ts` (変更)

- props から `distributionDomainName` を削除
- 公開フィールドから `userPoolClient` を削除し、 `googleIdp` を public readonly として公開
- メソッド内の `this.userPoolClient = this.userPool.addClient(...)` ブロックを削除
- `this.userPoolClient.node.addDependency(googleIdp)` を削除
- `CfnOutput("UserPoolClientId", ...)` を削除
- `UserPoolId`, `UserPoolDomainPrefix` の出力は残す

### `infra/cdk/src/main.ts` (変更)

`AuthStack` のインスタンス化を以下のように変更:

```ts
const authStack = new AuthStack(app, `${envName}-Auth`, {
  googleClientId,
  googleClientSecret,
});
```

`distributionStack` の後ろ、 `dataStack` の前あたりで `AuthClientStack` を追加:

```ts
new AuthClientStack(app, `${envName}-AuthClient`, {
  userPool: authStack.userPool,
  googleIdp: authStack.googleIdp,
  distributionDomainName: distributionStack.distribution.distributionDomainName,
});
```

## スタック依存関係 (変更後)

```
StorageStack          (独立)
DistributionStack     ← StorageStack
DeploymentStack       ← StorageStack, DistributionStack
AuthStack             (独立)              ← Distribution への依存を解消
AuthClientStack       ← AuthStack, DistributionStack   ← 新規
DataStack             (独立)
```

## 既存環境への影響と運用上の注意

- 既存の `${envName}-Auth` スタックには `UserPoolClient` (`WebClient`) が含まれている。
  本変更を deploy すると、 `AuthStack` 側で `UserPoolClient` が削除され、
  `AuthClientStack` 側で別リソースとして再作成される。
  → **UserPoolClient ID は変わる**ため、フロントエンド (`apps/frontend` の Amplify 設定)
    に持っている `userPoolClientId` を新値で更新する必要がある。
- UserPool 自体は `${envName}-Auth` に残るため、 **既存の Cognito ユーザーアカウントは
  保持される**。
- Google IDP も `${envName}-Auth` に残るため、 Google OAuth の設定変更は不要。

deploy 順序: `cdk deploy dev-Auth dev-AuthClient` (もしくは `cdk deploy --all`)。
`cdk` は依存解決により自動的に正しい順序で deploy する。

## Verification

1. `pnpm --filter @vue-hono-aws-cdk/iac exec cdk synth` を実行し、 synth が成功することを
   確認 (5 スタック → 6 スタックに増えていること)
2. `cdk diff dev-Auth` を実行し、`UserPoolClient` および出力 `UserPoolClientId` が
   削除されていること、 `googleIdp` を含むその他のリソースに変化がないことを確認
3. `cdk diff dev-AuthClient` を実行し、`UserPoolClient` リソースが新規追加されること、
   `Fn::ImportValue` で AuthStack の UserPool ID と DistributionStack の domain name を
   参照していることを確認
4. `cdk deploy dev-Auth dev-AuthClient` で deploy
5. AWS マネジメントコンソールまたは
   `aws cloudformation describe-stacks --stack-name dev-AuthClient --query "Stacks[0].Outputs"`
   で `UserPoolClientId` を取得
6. (動作確認) 取得した新しい `UserPoolClientId` をフロントエンドの Amplify 設定
   (`apps/frontend/src/lib/amplify.ts` 周辺) の値と置き換え、 `pnpm --filter frontend dev`
   で Google ログインが成功することを確認

## Critical Files

- `/workspaces/vue-hono-aws-cdk/infra/cdk/src/stacks/auth-stack.ts` (変更)
- `/workspaces/vue-hono-aws-cdk/infra/cdk/src/stacks/auth-client-stack.ts` (新規)
- `/workspaces/vue-hono-aws-cdk/infra/cdk/src/main.ts` (変更)

## Out of Scope (今回は実施しない)

- BackendStack (Lambda + API Gateway + Cognito Authorizer) の追加
- CloudFront `/api/*` ルーティング
- 既存 `DistributionStack` の S3 BucketPolicy (CloudFront-S3 関連付け) の分離
- `apps/frontend` の Amplify 設定値の更新 (CDK 側のみ作業し、必要に応じて手動更新)
- `docs/state.md` の更新

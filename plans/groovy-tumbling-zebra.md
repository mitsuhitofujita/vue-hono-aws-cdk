# Cognito リソース定義 (CDK)

## Context

tocoopアプリケーションにGoogle認証を追加するため、CDKにCognitoリソースを定義する。`docs/state.md`の「開発中」タスクに該当。仕様上、認証はGoogle-onlyで、アプリに必要な属性は表示名・識別子・プロフィール画像。

## 変更対象ファイル

| ファイル | 操作 |
|---------|------|
| `infra/cdk/src/stacks/auth-stack.ts` | 新規作成 |
| `infra/cdk/src/main.ts` | 修正 |
| `docs/state.md` | 更新 |

## 実装内容

### 1. `infra/cdk/src/stacks/auth-stack.ts` を新規作成

**Props:**
```typescript
interface AuthStackProps extends StackProps {
  distributionDomainName: string;  // CloudFrontドメイン（コールバックURL用）
  googleClientId: string;          // Google OAuth Client ID
  googleClientSecret: string;      // Google OAuth Client Secret
}
```

**作成するリソース:**

#### A. User Pool
- `selfSignUpEnabled: false` — Google-onlyなので自己サインアップ不要
- `signInAliases: { email: true }` — フェデレーションユーザーはemailで連携
- `standardAttributes.email: { required: true, mutable: true }`
- `standardAttributes.fullname: { required: false, mutable: true }` — 表示名
- `standardAttributes.profilePicture: { required: false, mutable: true }` — プロフィール画像URL
- `accountRecovery: AccountRecovery.NONE` — Google-onlyなのでパスワード回復不要
- `removalPolicy: RemovalPolicy.DESTROY` — 既存スタックと同じポリシー
- `featurePlan: FeaturePlan.LITE` — フェデレーション認証は10,000 MAUまで無料（$0運用の要件に合致）
- `mfa: Mfa.OFF` — Google側で2FA管理

#### B. Google Identity Provider
- `UserPoolIdentityProviderGoogle`
- `clientId` / `clientSecretValue` — CDKコンテキストから取得
- `scopes: ["openid", "email", "profile"]`
- 属性マッピング: `email` → `GOOGLE_EMAIL`, `fullname` → `GOOGLE_NAME`, `profilePicture` → `GOOGLE_PICTURE`

#### C. User Pool Domain（Cognitoホストドメイン）
- `cognitoDomain: { domainPrefix: "${envName}-tocoop" }`
- ホストUI URL: `https://${envName}-tocoop.auth.{region}.amazoncognito.com`

#### D. User Pool Client
- `generateSecret: false` — SPAはパブリッククライアント
- `supportedIdentityProviders: [GOOGLE]` — COGNITOを除外してユーザー名/パスワード認証を防止
- `oAuth.flows: { authorizationCodeGrant: true }` — SPA向けのAuthorization Code Flow
- `callbackUrls`: `["https://${distributionDomainName}/", "http://localhost:5173/"]`
- `logoutUrls`: `["https://${distributionDomainName}/", "http://localhost:5173/"]`
- `oAuth.scopes: [OPENID, EMAIL, PROFILE]`
- `node.addDependency(googleIdp)` — IdP作成後にClientを作成する依存関係を明示

#### E. CfnOutput
- `UserPoolId`
- `UserPoolClientId`
- `UserPoolDomainPrefix`

### 2. `infra/cdk/src/main.ts` を修正

- `AuthStack`をimport
- CDKコンテキストから`googleClientId`と`googleClientSecret`を取得
- `distributionStack`の後に`AuthStack`をインスタンス化

```typescript
const googleClientId = app.node.tryGetContext("googleClientId") ?? "";
const googleClientSecret = app.node.tryGetContext("googleClientSecret") ?? "";

new AuthStack(app, `${envName}-Auth`, {
  distributionDomainName: distributionStack.distribution.distributionDomainName,
  googleClientId,
  googleClientSecret,
});
```

### 3. `docs/state.md` を更新

「開発中」から「完了」へ移動。

## Google OAuth資格情報の扱い

- Google Cloud Consoleで事前にOAuth 2.0認証情報を作成する（CDK外の手動作業）
- Client IDとClient Secretは`cdk deploy`時に`-c`フラグで渡す:
  ```bash
  npx cdk deploy "*-Auth" -c googleClientId=xxx -c googleClientSecret=yyy
  ```
- Google側の「承認済みリダイレクトURI」に設定する値:
  `https://${envName}-tocoop.auth.${region}.amazoncognito.com/oauth2/idpresponse`

## 検証方法

```bash
cd infra/cdk && npx cdk synth -c googleClientId=test -c googleClientSecret=test
```

`cdk.out/dev-Auth.template.json`に以下のリソースが含まれることを確認:
- `AWS::Cognito::UserPool`
- `AWS::Cognito::UserPoolIdentityProvider`（Google）
- `AWS::Cognito::UserPoolDomain`
- `AWS::Cognito::UserPoolClient`

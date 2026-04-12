# Static Web Deployment 実装計画

## Context

フロントエンド（Vue.js SPA）のビルド成果物をS3にアップロードし、CloudFrontキャッシュを無効化するデプロイ機構が未実装。CDKの`BucketDeployment`を使い、インフラ定義と一元管理する。

## 方針

CDK `aws-s3-deployment.BucketDeployment` を使用する。

- S3 syncとCloudFrontキャッシュ無効化を宣言的に1つのconstructで実現
- Lambda裏打ち（従量課金、$0要件を満たす）
- アセットハッシュで変更検出、変更時のみ再デプロイ
- シェルスクリプト（`aws s3 sync`）と比較して、CDKに一元化でき学習目的にも合致

## スタック配置

specの「更新頻度によるスタック分離」方針に従い、新規`DeploymentStack`を作成:

| Stack | 更新頻度 | 内容 |
|-------|---------|------|
| StorageStack | 低 | S3バケット |
| DistributionStack | 中 | CloudFront |
| **DeploymentStack** (新規) | **高** | BucketDeployment |

`BucketDeployment`は既存リソースの「関連付け」のみ行い、構造的リソースを作成しない。メモリの分離方針にも合致。

## 変更内容

### 1. `infra/cdk/src/stacks/distribution-stack.ts` を修正

`distribution`をpublic readonlyプロパティとして公開する。

```typescript
// 追加: クラスプロパティ
public readonly distribution: cloudfront.Distribution;

// 変更: const distribution → this.distribution
this.distribution = new cloudfront.Distribution(this, "Distribution", { ... });

// constructor内のdistribution参照をthis.distributionに更新（2箇所）
// - CfnBucketPolicy内のdistribution.distributionId
// - CfnOutput内のdistribution.distributionDomainName, distribution.distributionId
```

### 2. `infra/cdk/src/stacks/deployment-stack.ts` を新規作成

```typescript
import { Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "node:path";
import type { Construct } from "constructs";

interface DeploymentStackProps extends StackProps {
  websiteBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
}

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, "../../../../apps/frontend/dist"),
        ),
      ],
      destinationBucket: props.websiteBucket,
      distribution: props.distribution,
      distributionPaths: ["/*"],
    });
  }
}
```

- `__dirname`はts-node実行時に`infra/cdk/src/stacks/`を指す → `../../../../apps/frontend/dist`で正しいパス
- `distributionPaths: ["/*"]`でワイルドカード無効化（月1,000パスまで無料）
- `prune: true`（デフォルト）で古いファイルを自動削除

### 3. `infra/cdk/src/main.ts` を修正

```typescript
import { DeploymentStack } from "./stacks/deployment-stack";

// 既存のDistributionStack生成を変数に格納
const distributionStack = new DistributionStack(app, `${envName}-Distribution`, {
  websiteBucketName: storageStack.websiteBucket.bucketName,
});

// 新規追加
new DeploymentStack(app, `${envName}-Deployment`, {
  websiteBucket: storageStack.websiteBucket,
  distribution: distributionStack.distribution,
});
```

### 4. ルート `package.json` に便利スクリプト追加

```json
{
  "scripts": {
    "kill-port": "bash scripts/kill-port/kill-port.sh",
    "build:frontend": "pnpm --filter @vue-hono-aws-cdk/frontend build",
    "deploy": "pnpm build:frontend && pnpm --filter @vue-hono-aws-cdk/iac cdk deploy --all",
    "deploy:web": "pnpm build:frontend && pnpm --filter @vue-hono-aws-cdk/iac cdk deploy \"*-Deployment\""
  }
}
```

- `pnpm deploy`: 全スタックデプロイ（初回セットアップ時）
- `pnpm deploy:web`: フロントエンドのみビルド＋デプロイ（通常の開発ワークフロー）

### 5. `docs/state.md` を更新

「開発中」→「完了」に移動。

## デプロイワークフロー

**初回（インフラ構築 + デプロイ）:**
```bash
pnpm deploy
```

**フロントエンド更新時（通常の開発）:**
```bash
pnpm deploy:web
```

## 検証方法

1. `pnpm build:frontend` でフロントエンドがビルドされ、`apps/frontend/dist/`にファイルが生成されることを確認
2. `cd infra/cdk && npx cdk synth` でCloudFormationテンプレートが正常に生成されることを確認
3. テンプレート内に`Custom::CDKBucketDeployment`リソースが含まれることを確認
4. （AWS環境がある場合）`pnpm deploy`で全スタックがデプロイされ、CloudFrontのURLでアプリが表示されることを確認

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `infra/cdk/src/stacks/distribution-stack.ts` | 修正 |
| `infra/cdk/src/stacks/deployment-stack.ts` | 新規作成 |
| `infra/cdk/src/main.ts` | 修正 |
| `package.json`（ルート） | 修正 |
| `docs/state.md` | 修正 |

# Plan: Decouple S3 (StorageStack) and CloudFront (DistributionStack)

## Context

`docs/state.md` lists this work under **In Progress**:

> CDK refactoring — Currently CloudFront depends on S3. Separate into three stages: S3 creation, CloudFront creation, and association of both, to eliminate the dependency.

Today `DistributionStack` receives `websiteBucketName: storageStack.websiteBucket.bucketName` (a CFN token), which forces a CDK cross-stack export/import between Storage and Distribution. The same stack also owns the `s3.CfnBucketPolicy` that links the two — mixing *creation* and *association* in one place.

The recent `AuthStack` → `AuthClientStack` split (commits `30aa03a`, `1d38c5a`) established the team pattern: keep resource creation in one stack, put cross-resource wiring in a separate "client / association" stack. This refactor applies the same pattern to S3 + CloudFront, matching the saved feedback memory `CDKスタックの責務分離方針`.

## Outcome

- `StorageStack` and `DistributionStack` have **zero CFN cross-stack references** between them.
- A new `WebsiteOriginAccessStack` owns the OAC bucket policy (the only resource that links the two).
- The S3 bucket name is a literal string, derived from `envName`, computed once in `main.ts` and passed to every stack that needs it.

## Final stack layout

| Stack | Owns | Cross-stack refs (after) |
|---|---|---|
| `StorageStack` | `s3.Bucket` (with explicit `bucketName`) | none |
| `DistributionStack` | `cloudfront.Distribution` + auto-generated OAC | none |
| `WebsiteOriginAccessStack` *(new)* | `s3.CfnBucketPolicy` | → `DistributionStack` (distributionId) |
| `DeploymentStack` | `BucketDeployment` | → `StorageStack`, `DistributionStack` (unchanged) |
| `AuthStack` / `AuthClientStack` / `DataStack` | unchanged | unchanged |

## Bucket name strategy

Compute a literal in `main.ts` from `envName` only — no tokens, no env-vars, stacks stay env-agnostic:

```ts
const envName = app.node.tryGetContext("envName") ?? "dev";
const websiteBucketName = `tocoop-${envName}-website`;
```

Both `StorageStack` and `DistributionStack` receive this same literal string. `Bucket.fromBucketName(scope, id, literal)` does **not** synthesize an `Fn::ImportValue`, so the two stacks become independent.

The user is responsible for ensuring `envName` is globally unique (consistent with `docs/spec.md` "Each developer provisions their own cloud resource environment.").

## Files to modify / create

### `infra/cdk/src/main.ts` (modify)

- Compute `websiteBucketName` once.
- Pass it as a string prop to `StorageStack`, `DistributionStack`, and the new `WebsiteOriginAccessStack`.
- Wire the new stack between Distribution and Deployment.

```ts
const websiteBucketName = `tocoop-${envName}-website`;

const storageStack = new StorageStack(app, `${envName}-Storage`, {
  websiteBucketName,
});

const distributionStack = new DistributionStack(app, `${envName}-Distribution`, {
  websiteBucketName,
});

new WebsiteOriginAccessStack(app, `${envName}-WebsiteOriginAccess`, {
  websiteBucketName,
  distributionId: distributionStack.distribution.distributionId,
});

new DeploymentStack(app, `${envName}-Deployment`, {
  websiteBucket: storageStack.websiteBucket,
  distribution: distributionStack.distribution,
});
```

### `infra/cdk/src/stacks/storage-stack.ts` (modify)

- Add `StorageStackProps { websiteBucketName: string }`.
- Pass `bucketName: props.websiteBucketName` to the `s3.Bucket`.
- Keep `RemovalPolicy.DESTROY` and `autoDeleteObjects: true` (already set — required for safe redeploy).

### `infra/cdk/src/stacks/distribution-stack.ts` (modify)

- Continue to use `Bucket.fromBucketName(this, "WebsiteBucket", props.websiteBucketName)` — but the prop is now a *literal*, so no cross-stack ref is generated.
- Keep `S3BucketOrigin.withOriginAccessControl(websiteBucket)` here — the OAC is owned by this stack. This L2 only needs the bucket name/ARN to wire the origin and synthesize a `CfnOriginAccessControl`; it correctly skips auto-attaching a bucket policy because the bucket is imported.
- **Remove** the inline `s3.CfnBucketPolicy` block (lines 46–66) — it moves to the new stack.

### `infra/cdk/src/stacks/website-origin-access-stack.ts` (new)

```ts
import { Stack, type StackProps, Fn } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

interface WebsiteOriginAccessStackProps extends StackProps {
  websiteBucketName: string;
  distributionId: string;
}

export class WebsiteOriginAccessStack extends Stack {
  constructor(scope: Construct, id: string, props: WebsiteOriginAccessStackProps) {
    super(scope, id, props);

    new s3.CfnBucketPolicy(this, "WebsiteBucketPolicy", {
      bucket: props.websiteBucketName,
      policyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${props.websiteBucketName}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": Fn.join("", [
                  `arn:aws:cloudfront::${this.account}:distribution/`,
                  props.distributionId,
                ]),
              },
            },
          },
        ],
      },
    });
  }
}
```

### `infra/cdk/src/stacks/deployment-stack.ts` (no change)

`BucketDeployment` continues to receive bucket and distribution L2 references from `main.ts`. Optionally we may add `deployment.node.addDependency(websiteOriginAccessStack)` at the call-site if first-deploy uploads need the bucket policy in place — generally not required because CloudFront serves cached/empty content until S3 sync completes.

### `docs/state.md` (modify)

Move the "CDK refactoring — Separate into three stages" bullet from **In Progress** to **Completed**.

## Verification

Steps performed by Claude after editing:

1. `cd infra/cdk && pnpm exec cdk synth --all` — succeeds.
2. Confirm independence: no template for `*-Storage` or `*-Distribution` should contain an `Fn::ImportValue` referencing the other:
   ```bash
   grep -l "ImportValue" cdk.out/dev-Storage.template.json cdk.out/dev-Distribution.template.json || echo "OK: no cross-stack imports"
   ```
3. Confirm `WebsiteOriginAccessStack` template *does* contain an `Fn::ImportValue` for the distribution ID (the only intended cross-stack ref).

Steps performed by the user (Claude does **not** run these):

4. `pnpm exec cdk destroy --all` — per the chosen migration path (`docs/spec.md` permits free destroy/recreate; the existing auto-named bucket cannot be reused).
5. `pnpm exec cdk deploy --all` from scratch.
6. Open `https://<DistributionDomainName>/` and confirm the home page loads (validates OAC + bucket policy actually wire correctly).
7. `pnpm exec cdk deploy --all` again — should report "no changes" for the storage/distribution/origin-access stacks (idempotency check).

## Migration notes

- Switching from auto-generated to explicit `bucketName` is a **replacement** in CFN; the chosen migration path is `cdk destroy --all` first, then `cdk deploy --all`.
- The literal name `tocoop-${envName}-website` must be globally unique across all S3. If a collision occurs, the user can adjust `envName`.

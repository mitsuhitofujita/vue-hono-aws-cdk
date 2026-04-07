# Plan: AWS CDK Project Initialization with CloudFront + S3

## Context

The repository currently contains only documentation and devcontainer configuration — no application code or infrastructure exists. The `docs/state.md` "In Progress" items are:

1. AWS CDK project initialization
2. CloudFront distribution resource
3. S3 bucket for static website hosting

This plan sets up the pnpm monorepo foundation and creates CDK stacks for static website hosting via CloudFront + S3 with Origin Access Control (OAC).

## Architecture Decisions

- **Two CDK stacks** per the spec's "update frequency" strategy:
  - `StorageStack` (rarely changed) — S3 bucket
  - `DistributionStack` (frequently changed) — CloudFront distribution. Will be modified when backend API is added later.
- **Origin Access Control (OAC)** — modern best practice. S3 bucket stays fully private, accessed only via CloudFront.
- **Per-developer environments** via CDK context variable `envName` (default: `dev`, override with `-c envName=alice`). Stack names: `{envName}-Storage`, `{envName}-Distribution`.
- **S3 RemovalPolicy: DESTROY** with `autoDeleteObjects: true` — dev environments can be freely destroyed per spec.
- **CloudFront SPA error handling** — 403/404 mapped to `/index.html` with 200 status for Vue Router history mode.
- **PriceClass 100** — cheapest tier (NA + Europe). Personal learning project.
- **CommonJS for CDK** — `aws-cdk-lib` requires CJS. Frontend/backend can use ESM later.
- **TypeScript ~5.8** — CDK compatibility not confirmed for TS 6.x yet.
- **`ts-node`** for CDK app execution — standard CDK approach, no build step needed for synth/deploy.

## Files to Create/Modify

### Root monorepo setup

| File | Action |
|------|--------|
| `package.json` | CREATE — root workspace package.json |
| `pnpm-workspace.yaml` | CREATE — workspace member declarations |
| `.npmrc` | CREATE — `auto-install-peers=true` |
| `.gitignore` | MODIFY — add `node_modules/` |

### CDK project (`infra/iac/`)

| File | Action |
|------|--------|
| `infra/iac/package.json` | CREATE — CDK dependencies and scripts |
| `infra/iac/tsconfig.json` | CREATE — TypeScript config (CJS, strict) |
| `infra/iac/cdk.json` | CREATE — CDK app config with default envName |
| `infra/iac/.gitignore` | CREATE — CDK-specific ignores (dist/, cdk.out/, *.js, *.d.ts) |
| `infra/iac/src/main.ts` | CREATE — CDK app entry point, reads envName, wires stacks |
| `infra/iac/src/stacks/storage-stack.ts` | CREATE — S3 bucket (private, DESTROY policy, autoDeleteObjects) |
| `infra/iac/src/stacks/distribution-stack.ts` | CREATE — CloudFront distribution with OAC S3 origin |

### Documentation

| File | Action |
|------|--------|
| `docs/state.md` | MODIFY — update development state |

## Implementation Steps

1. Create root monorepo files: `package.json`, `pnpm-workspace.yaml`, `.npmrc`
2. Update `.gitignore` to add `node_modules/`
3. Create `infra/iac/` directory structure: `package.json`, `tsconfig.json`, `cdk.json`, `.gitignore`
4. Create CDK source files: `src/main.ts`, `src/stacks/storage-stack.ts`, `src/stacks/distribution-stack.ts`
5. Run `pnpm install` from repository root
6. Verify with `pnpm --filter @vue-hono-aws-cdk/iac cdk synth -c envName=dev`
7. Update `docs/state.md`

## Key Implementation Details

### `infra/iac/package.json` dependencies
- `aws-cdk-lib`: ^2.200.0
- `constructs`: ^10.6.0
- devDeps: `aws-cdk` (CLI), `ts-node`, `typescript` (~5.8.0)

### StorageStack
- Exposes `websiteBucket` as public property for cross-stack reference
- CfnOutput for bucket name

### DistributionStack
- Receives `websiteBucket` via props
- Uses `S3BucketOrigin.withOriginAccessControl()`
- Error responses: 403→200 `/index.html`, 404→200 `/index.html`
- CfnOutputs for distribution domain name and ID

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "tests/*"
  - "infra/*"
```
Empty globs (`apps/*`, `tests/*`) are silently ignored by pnpm.

## Verification

1. `pnpm --filter @vue-hono-aws-cdk/iac cdk synth -c envName=dev` — should produce CloudFormation templates without errors
2. Inspect `infra/iac/cdk.out/` for two templates: `dev-Storage.template.json` and `dev-Distribution.template.json`
3. Verify S3 bucket has `BlockPublicAccess: BLOCK_ALL` and `DeletionPolicy: Delete` in template
4. Verify CloudFront distribution has OAC configuration, error responses, and S3 origin in template

## Notes

- CDK bootstrap (`cdk bootstrap`) is required once per AWS account/region before first deploy — not part of this plan
- `autoDeleteObjects: true` creates a Lambda-backed custom resource in StorageStack (standard CDK pattern)
- Future backend addition: add `/api/*` behavior to DistributionStack pointing to API Gateway origin — no restructuring needed

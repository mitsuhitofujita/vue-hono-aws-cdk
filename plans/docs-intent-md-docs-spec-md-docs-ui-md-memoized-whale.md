# Backend Scaffolding — Hono on Lambda

## Context

`docs/state.md` has this task in **In Progress**:

> Backend code scaffolding
> - Initial setup of the Hono framework targeting Lambda (in `apps/backend`)
> - Implement the item list API returning an empty (or dummy) item list

Today `apps/backend/` does not exist. The repo is a pnpm monorepo with only `apps/frontend` (Vue 3 + Vite, ESM, TypeScript `~5.8.0`) and `infra/cdk` (`@vue-hono-aws-cdk/iac`, CDK v2.200). `infra/cdk/src/stacks/data-stack.ts` already provisions the DynamoDB `ItemsTable` (partition `userId`, sort `itemId`), but nothing reads from it yet.

The goal here is to land a runnable, type-checked Hono app that serves `GET /api/items` with dummy data and exports a Lambda handler shaped for API Gateway. The user will verify via `pnpm dev`; CDK wiring is explicitly out of scope and is the next task in `docs/state.md` (*Backend Lambda resource provisioning*).

## Architecture

Single new workspace package `@vue-hono-aws-cdk/backend` at `apps/backend/`. ESM (`"type": "module"`), TypeScript `~5.8.0`, no build step — `tsc --noEmit` type-checks, and CDK's `NodejsFunction` will bundle `src/lambda.ts` with esbuild in the next task. Routes are registered at their full literal path (`GET /api/items`), not behind `app.basePath('/api')`, because the CloudFront → API Gateway path-based routing forwards `/api/*` unchanged and keeping the literal path makes `grep "/api/items"` work across frontend and backend.

The app is split into three entry files because the Lambda and Node adapters cannot coexist in a single module (each imports a different Hono adapter). Keeping route definitions adapter-agnostic in `app.ts` avoids a rewrite when CDK integration lands.

## Files to create

| File | Purpose |
|---|---|
| `apps/backend/package.json` | Workspace manifest — name, ESM, scripts, deps |
| `apps/backend/tsconfig.json` | `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict`, `noEmit`, `types: ["node"]`, `include: ["src/**/*.ts"]` |
| `apps/backend/.gitignore` | `node_modules`, `dist` |
| `apps/backend/src/app.ts` | `export const app = new Hono()`; registers `GET /api/items` returning the dummy list |
| `apps/backend/src/lambda.ts` | `import { handle } from 'hono/aws-lambda'; import { app } from './app.js'; export const handler = handle(app);` |
| `apps/backend/src/dev.ts` | `import { serve } from '@hono/node-server'; import { app } from './app.js'; serve({ fetch: app.fetch, port: 3000 });` |

### Dummy response shape for `GET /api/items`

```json
{ "items": [
  { "itemId": "i1", "name": "エアコン", "purchaseYear": 2026, "purchaseMonth": 3 },
  { "itemId": "i2", "name": "冷蔵庫",   "purchaseYear": 2025, "purchaseMonth": 11 },
  { "itemId": "i3", "name": "洗濯機",   "purchaseYear": 2024, "purchaseMonth": 6 }
] }
```

- Separate `purchaseYear` (number) and `purchaseMonth` (1–12 number) fields rather than a `"2026-03"` string — `docs/spec.md` defines purchase date as year + month (not a full date), the UI mockup renders them as `YYYY.MM`, and DynamoDB will store them as separate attributes. A string forces every consumer to re-parse.
- Sorted descending by `(purchaseYear, purchaseMonth)` to match the item list mockup.

## Dependencies

**runtime**
- `hono@^4` — framework; provides `hono/aws-lambda` adapter

**dev**
- `@hono/node-server@^1` — canonical local dev server for Hono on Node
- `tsx@^4` — zero-config TS runner with `--watch`; lighter than `ts-node` for ESM
- `typescript@~5.8.0` — pinned to match the monorepo
- `@types/node@^22` — Lambda Node 22 runtime target; matches devcontainer `node:lts-slim`

Explicitly NOT added: `@types/aws-lambda` (Hono's adapter supplies the types), `esbuild`/`tsup` (CDK bundles next phase), `zod`, `dotenv` (nothing to validate or configure yet).

## `package.json` scripts

- `"dev": "tsx watch src/dev.ts"` — local server on port 3000
- `"typecheck": "tsc --noEmit"`

No `build` script (CDK owns bundling). No root-level `dev:backend` proxy — matches the existing convention where the root `package.json` only proxies deploy/build, not dev.

## Verification

- `pnpm install` at repo root — installs the new workspace package.
- `pnpm --filter @vue-hono-aws-cdk/backend typecheck` — passes with no errors.
- `pnpm --filter @vue-hono-aws-cdk/backend dev` — boots on `http://localhost:3000`; `curl http://localhost:3000/api/items` returns the dummy JSON above with HTTP 200 and `content-type: application/json`.
- `curl http://localhost:3000/nonexistent` returns 404 (default Hono behavior).

## Caveats carried to the next task (CDK Lambda stack)

1. **ESM bundling**: `NodejsFunction` must be configured with `runtime: Runtime.NODEJS_22_X`, `bundling.format: OutputFormat.ESM`, and `mainFields: ['module', 'main']`. Without these the `hono/aws-lambda` named exports will mis-bundle.
2. **Handler contract**: entry `apps/backend/src/lambda.ts`, export name `handler`. Lock this so the CDK task does not need a rename.
3. **Local dev has no API Gateway event shape**: `tsx watch src/dev.ts` serves plain HTTP. Auth-header and `requestContext` behavior diverges from the Lambda event. Acceptable for scaffolding; revisit when the Cognito authorizer lands.
4. **Stack responsibility split**: per the CDK separation memory, the next task should create the Lambda function resource and its API Gateway association in separate constructs.

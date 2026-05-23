# Plan: Introduce ESLint v9 (Flat Config) + Prettier to the Monorepo

## Context

`docs/state.md` lists "Linter integration — Adopt ESLint v9 (Vue + TypeScript)"
as the current In Progress item, and `docs/issue/01-introduce-eslint.md`
captures the decision in detail. The repository currently has **no** linter
or formatter configured at any level: no `eslint.config.*`, no
`.prettierrc.*`, no lint scripts in any `package.json`. The application
code (Vue 3 SFCs in `apps/frontend`, Hono on Node/Lambda in `apps/backend`,
CDK in `infra/cdk`) is growing — three workspaces, ~15 TS/Vue source
files — and the developer wants automated detection of bad TypeScript
patterns and Vue template / reactivity bugs before features keep landing.

This plan executes Phases 1–4 of the issue's todo list. Per the user's
decisions during planning:

- Add Prettier alongside ESLint (with `format` / `format:check` scripts).
- Enable **type-aware linting** via `parserOptions.projectService`.
- Single root `eslint.config.js` covering all workspaces.
- Keep `spec.md` unchanged for now (its `Linter | oxlint` row will be
  reconciled in a separate task).

## Goals

- One root `eslint.config.js` understands `.ts`, `.vue`, and `.js` files
  across `apps/frontend`, `apps/backend`, `infra/cdk`, and root configs.
- `pnpm lint` at the repo root surfaces real Vue/TS issues; `pnpm lint:fix`
  auto-fixes the safe ones.
- Prettier owns formatting via `pnpm format` / `pnpm format:check`; ESLint
  delegates formatting rules to it (`eslint-config-prettier`).
- Each workspace gets `lint` / `lint:fix` / `format` / `format:check`
  scripts that operate on that workspace's files only.

## Non-goals

- No CI wiring (GitHub Actions, pre-commit hooks). The "CI/CD strategy" row
  in `spec.md` is still Undecided; we will not pre-empt it here.
- No `spec.md` edits (per user decision).
- No code refactors triggered by lint findings beyond the minimum needed to
  reach a clean baseline. Larger cleanups, if discovered, are tracked as
  follow-ups, not bundled.

---

## Phase 1 — Install dependencies (root only)

All linting/formatting tooling lives at the repo root so workspaces share
one version. pnpm exposes the root `node_modules/.bin` to every workspace
script automatically, so per-workspace `eslint .` resolves without
duplicating installs.

Add to root `package.json` `devDependencies` via
`pnpm add -D -w <pkg>...`:

| Package | Purpose |
|---|---|
| `eslint` | Linter core (v9, flat config). |
| `@eslint/js` | Base JS recommended config. |
| `typescript-eslint` | Unified package exposing parser + plugin + configs (incl. `configs.recommendedTypeChecked`). |
| `eslint-plugin-vue` | Vue SFC linting (template, reactivity, style-guide). |
| `vue-eslint-parser` | Required so `<script lang="ts">` blocks are parsed by `@typescript-eslint/parser`. |
| `eslint-plugin-import-x` | Import-order / resolution rules (v9-compatible fork of eslint-plugin-import). |
| `eslint-plugin-unused-imports` | Auto-remove unused imports (separate from `no-unused-vars`). |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier formatting. |
| `prettier` | Formatter. |
| `globals` | Predefined global-variable sets (browser, node) for ESLint env. |

## Phase 2 — Configuration files (root)

### `eslint.config.js` (ESM, root)

Use `tseslint.config(...)` so type inference flows through the array. Order
matters: `eslint-config-prettier` must be **last** so it can disable
conflicting style rules from earlier blocks.

Config blocks, in order:

1. **Global ignores.** `dist/**`, `**/dist/**`, `**/cdk.out/**`,
   `**/node_modules/**`, `**/*.tsbuildinfo`, `pnpm-lock.yaml`,
   `apps/frontend/dist/**`. (Match patterns currently in the per-workspace
   `.gitignore` files.) Also ignore `infra/cdk/**/*.{js,d.ts,js.map,d.ts.map}`
   to match `infra/cdk/.gitignore`.
2. **Base JS rules** — `eslint.configs.recommended` applied to all
   `**/*.{js,mjs,cjs,ts,mts,cts,vue}`.
3. **TypeScript (type-aware) rules** — spread
   `tseslint.configs.recommendedTypeChecked` for
   `**/*.{ts,mts,cts,vue}`. In the same block:
   ```js
   languageOptions: {
     parserOptions: {
       projectService: true,
       tsconfigRootDir: import.meta.dirname,
       extraFileExtensions: ['.vue'],
     },
   }
   ```
   `projectService: true` lets typescript-eslint discover each workspace's
   nearest `tsconfig.json` automatically, so no per-package `project` array
   is needed. Verified to work with the existing tsconfigs:
   `apps/frontend/tsconfig.app.json` (includes `src/**/*.ts`,
   `src/**/*.vue`), `apps/frontend/tsconfig.node.json` (`vite.config.ts`),
   `apps/backend/tsconfig.json`, `infra/cdk/tsconfig.json`.
4. **Vue rules**, scoped to `apps/frontend/**/*.vue`. Spread
   `pluginVue.configs['flat/recommended']`, then set
   ```js
   languageOptions: {
     parser: vueParser,
     parserOptions: { parser: tseslint.parser, projectService: true, extraFileExtensions: ['.vue'] },
   }
   ```
   so the `<script lang="ts">` body is parsed by typescript-eslint while
   the SFC outer structure is parsed by `vue-eslint-parser`.
5. **`eslint-plugin-import-x`** — apply
   `importX.flatConfigs.recommended` + `importX.flatConfigs.typescript`
   to `**/*.{ts,mts,cts,vue}` so it uses the TS resolver and understands
   the `@/*` alias declared in `apps/frontend/tsconfig.app.json`.
6. **`eslint-plugin-unused-imports`** — turn off
   `@typescript-eslint/no-unused-vars` and `no-unused-vars`, turn on
   `unused-imports/no-unused-imports` (error) and
   `unused-imports/no-unused-vars` (warn, with the standard
   `argsIgnorePattern: '^_'`).
7. **Globals per environment.**
   - `apps/frontend/**/*.{ts,vue}` → `globals.browser`.
   - `apps/backend/**/*.ts`, `infra/cdk/**/*.ts` → `globals.node`.
   - Vite/CDK config files (`*.config.{js,ts,mjs}`) → `globals.node` too.
8. **Disable type-aware rules on plain JS** — apply
   `tseslint.configs.disableTypeChecked` to `**/*.{js,mjs,cjs}` so root
   config files (`eslint.config.js`, future `prettier.config.js`) do not
   trip type-checked rules.
9. **`eslint-config-prettier`** — final block, no `files` filter, so it
   wins last.

### `prettier.config.js` (root, ESM)

Minimal, project-default settings; nothing exotic. Single source of truth
across all workspaces.

```js
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
};
```

### `.prettierignore` (root)

Mirror the ESLint ignores (build outputs, lockfiles, `cdk.out`,
`.tsbuildinfo`). Add `pnpm-lock.yaml` and `*.md` snapshot dirs only if
needed — keep the list minimal.

## Phase 3 — Scripts

### Root `package.json`

Add:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

### Each workspace `package.json`

(`apps/frontend`, `apps/backend`, `infra/cdk`)

Add the same four scripts. `eslint .` and `prettier --write .` resolve to
the root binary because pnpm prepends the root `node_modules/.bin` to
`PATH` for workspace scripts, so no extra wrapper is needed. Running them
from inside a workspace constrains the working directory and therefore the
file set, giving per-workspace linting "for free".

## Phase 4 — Verification & cleanup

1. `pnpm install` from the repo root.
2. `pnpm lint` from the repo root — expect some findings on existing
   source. Triage:
   - Auto-fixable → `pnpm lint:fix` and review the diff.
   - Type-aware findings in existing code (e.g. unawaited Promises in
     Hono handlers, missing `await` in Amplify calls) → fix or, if the
     finding is genuinely a false positive in this codebase, narrow the
     rule via an inline disable with a one-line reason. **Do not** disable
     rules globally to silence the baseline.
3. `pnpm format` once to bring the tree to Prettier's baseline. Confirm
   the diff is mechanical (quotes, trailing commas, line width) — anything
   semantic is a Prettier-config bug, not a code bug.
4. From each workspace, smoke-test:
   `pnpm --filter @vue-hono-aws-cdk/frontend lint`,
   `pnpm --filter @vue-hono-aws-cdk/backend lint`,
   `pnpm --filter @vue-hono-aws-cdk/iac lint`.
   Each should exit 0 (after cleanup) and only inspect its own workspace.
5. `pnpm --filter @vue-hono-aws-cdk/frontend build` and
   `pnpm --filter @vue-hono-aws-cdk/backend typecheck` still pass — lint
   setup must not regress existing tooling.
6. Editor integration: VS Code with the ESLint extension should pick up
   `eslint.config.js` automatically (flat config is default in v9). No
   `.vscode/settings.json` is in the repo today; do not add one as part of
   this task (developer-specific).

After the lint baseline is clean, update `docs/state.md`: move "Linter
integration — Adopt ESLint v9" from `In Progress` to `Completed`, and add
a Prettier line to the Completed list.

---

## Files touched

**Create**

- `/workspaces/vue-hono-aws-cdk/eslint.config.js`
- `/workspaces/vue-hono-aws-cdk/prettier.config.js`
- `/workspaces/vue-hono-aws-cdk/.prettierignore`

**Modify**

- `/workspaces/vue-hono-aws-cdk/package.json` — add devDependencies + 4 scripts.
- `/workspaces/vue-hono-aws-cdk/apps/frontend/package.json` — add 4 scripts.
- `/workspaces/vue-hono-aws-cdk/apps/backend/package.json` — add 4 scripts.
- `/workspaces/vue-hono-aws-cdk/infra/cdk/package.json` — add 4 scripts.
- `/workspaces/vue-hono-aws-cdk/docs/state.md` — move the In Progress
  bullet to Completed once Phase 4 passes.
- Source files only as needed to clear genuine lint findings; bundled in
  the same commit as the config introduction so the baseline lands clean.

## Risks & mitigations

- **Type-aware lint slowness on the CDK package** — `projectService`
  loads the nearest tsconfig per file. If `infra/cdk/tsconfig.json` ends
  up pulling in `cdk.out/**`, lint will be slow and noisy. The ignore
  block in step 1 prevents this; double-check by running `pnpm lint`
  on `infra/cdk` alone.
- **Vue parser ↔ typescript-eslint integration is fragile** — the parser
  options block in step 4 is the documented working shape; deviating
  (e.g. forgetting `extraFileExtensions: ['.vue']`) silently disables
  TS rules inside SFCs. Verify by intentionally introducing an
  unawaited Promise inside a `<script setup lang="ts">` and confirming
  the rule fires before declaring done.
- **Prettier diff is large** — first `pnpm format` run will touch many
  files. Land it as its own commit on top of the config commit so future
  blame ignores it via `git blame --ignore-rev`. (Don't create the
  ignore-revs file yet; only if the developer wants it later.)
- **`spec.md` stays inconsistent** — `Linter | oxlint` row is left as-is
  per user decision. This is a known divergence to be addressed in a
  follow-up task.

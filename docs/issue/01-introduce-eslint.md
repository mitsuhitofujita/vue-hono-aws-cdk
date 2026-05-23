# Issue: #1 Introduce ESLint v9 (Flat Config) to the Monorepo

## State

- **Status:** Open
- **Labels:** `enhancement`, `dx`, `learning`
- **Assignees:** Antigravity & @mitsuhitofujita

## Description

This issue outlines the plan to introduce **ESLint v9 (Flat Config)** to our learning-oriented web development monorepo (`tocoop`). As discussed, this setup will help us enforce best practices, catch bugs early (especially within Vue templates and TypeScript async handlers), and maintain a clean, standardized codebase.

### Background & Motivation

As defined in [docs/intent.md](file:///home/mitsuhito/repos/github/vue-hono-aws-cdk/docs/intent.md), this project is a personal learning workspace using **Vue 3 (Frontend)**, **Hono (Backend)**, and **AWS CDK (Infrastructure)**.
To support effective learning, we need a developer toolchain that:

1.  **Teaches best practices:** Detects bad patterns in TypeScript and Vue-specific APIs.
2.  **Has low maintenance overhead:** Leverages a single, centralized config to cover the entire monorepo.
3.  **Does not conflict with formatting:** Delegates code formatting to Prettier/editors while ESLint focuses on code quality.

---

### Tech Comparison (Summary of Discussion)

Before deciding on ESLint v9, we compared three modern choices:

1.  **ESLint v9 (Flat Config) [ADOPTED]**
    - **Pros:** Unmatched maturity, excellent Vue SFC template linting via `eslint-plugin-vue`. Flat config (`eslint.config.js`) makes monorepo configuration extremely clean.
    - **Cons:** Slower than Rust alternatives, but negligible in a small/medium repo.
2.  **Biome**
    - **Pros:** Blazing fast, all-in-one (Linter + Formatter).
    - **Cons:** Vue support is still basic/experimental (lacks deep template linting which is highly valuable for learning Vue).
3.  **oxlint**
    - **Pros:** Fast beyond belief, zero-config.
    - **Cons:** No formatter, no external plugin support, limited Vue template support. Best as a pre-commit filter, not a standalone framework linter.

---

### Proposed ESLint Plugins & Rationale

We will install these plugins at the root level and configure them via a single root `eslint.config.js`:

| Plugin / Config                    | Rationale                                                                                 |
| :--------------------------------- | :---------------------------------------------------------------------------------------- |
| **`@eslint/js`**                   | Standard JavaScript rules recommended by ESLint.                                          |
| **`typescript-eslint`**            | Essential for TypeScript type-safety rules across Frontend, Backend, and CDK.             |
| **`eslint-plugin-vue`**            | Detects Vue-specific template bugs, reactivity issues, and style guide violations.        |
| **`eslint-plugin-import-x`**       | High-performance, ESLint v9-compatible fork to maintain clean monorepo import structures. |
| **`eslint-plugin-unused-imports`** | Automates the removal of unused imports and variables during development.                 |
| **`eslint-config-prettier`**       | Disables formatting rules in ESLint to avoid conflicts with Prettier.                     |

---

### Monorepo Configuration Strategy

We will implement a **Single Root Configuration (`eslint.config.js`)** pattern:

- **Root Level (`/eslint.config.js`)**: Contains the master configuration utilizing ESLint v9 Flat Config.
- **Rules Differentiation**: Use the `files` property to apply `@eslint/js` + `typescript-eslint` to all TS files, while applying `eslint-plugin-vue` specifically to `apps/frontend/**/*.{ts,vue}`.
- **Local Scripts**: Add `lint` and `lint:fix` commands to each workspace package, delegating to the root eslint executable.

---

## Todo List

- [ ] **Phase 1: Installation**
  - [ ] Install ESLint and all selected plugins in the root workspace `devDependencies` using `pnpm`.
- [ ] **Phase 2: Configuration**
  - [ ] Create the root-level `/eslint.config.js` with the unified Flat Config.
  - [ ] Add standard ignores for build directories (`**/dist/**`, `**/cdk.out/**`, etc.).
- [ ] **Phase 3: Integration**
  - [ ] Add lint scripts (`pnpm lint`, `pnpm lint:fix`) to root and sub-packages' `package.json`.
- [ ] **Phase 4: Verification**
  - [ ] Run the linter, resolve any initial linting errors in the codebase, and verify editor integration.

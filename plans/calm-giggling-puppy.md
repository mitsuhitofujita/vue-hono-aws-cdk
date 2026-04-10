# Vue.js フロントエンドセットアップ計画

## Context

`docs/state.md`の「開発中」項目を実施する：
1. `apps/frontend` に Vue.js をセットアップ
2. ホームページにアプリケーションタイトル「tocoop」のみを表示

現在 `apps/` ディレクトリは存在しない。`pnpm-workspace.yaml` に `apps/*` は定義済み。

## 設計方針

- **手動セットアップ**（`create-vue`不使用）: 必要最小限のファイルのみ作成し、不要なボイラープレートを回避
- **最小構成**: Vue Router、Tailwind CSS、shadcn-vue、oxlint は今回のスコープ外（state.mdで「計画中」）
- TypeScript バージョンは CDK と合わせて `~5.8.0`
- パッケージ命名規則: `@vue-hono-aws-cdk/frontend`（既存の `@vue-hono-aws-cdk/iac` に準拠）

## 作成するファイル一覧

| ファイル | 目的 |
|---------|------|
| `apps/frontend/package.json` | Vue, Vite, TypeScript の依存定義 |
| `apps/frontend/index.html` | HTML エントリーポイント（Vue マウントポイント） |
| `apps/frontend/src/main.ts` | Vue アプリケーションのブートストラップ |
| `apps/frontend/src/App.vue` | ルートコンポーネント（「tocoop」を表示） |
| `apps/frontend/env.d.ts` | Vite クライアント型定義 |
| `apps/frontend/tsconfig.json` | ソリューションスタイル tsconfig（project references） |
| `apps/frontend/tsconfig.app.json` | Vue ソースコード用 TypeScript 設定 |
| `apps/frontend/tsconfig.node.json` | Vite config 用 TypeScript 設定 |
| `apps/frontend/vite.config.ts` | Vite 設定（Vue プラグイン + `@` エイリアス） |
| `apps/frontend/.gitignore` | `dist/` を除外 |

## 実装手順

### Step 1: ファイル作成

`apps/frontend/` 以下に上記10ファイルを作成する。

**package.json** の依存関係:
- `vue`: `^3.5.0`
- `@vitejs/plugin-vue`: `^6.0.0` (devDependencies)
- `vite`: `^8.0.0` (devDependencies)
- `typescript`: `~5.8.0` (devDependencies)
- `vue-tsc`: `^3.0.0` (devDependencies)

**App.vue**: `<h1>tocoop</h1>` を表示するだけのシンプルなコンポーネント

**index.html**: `lang="ja"`, `<title>tocoop</title>`

### Step 2: 依存関係インストール

```bash
pnpm install
```

ルートから実行。`apps/frontend` がワークスペースパッケージとして認識される。

### Step 3: 動作確認

```bash
pnpm --filter @vue-hono-aws-cdk/frontend dev
```

`http://localhost:5173` で「tocoop」が表示されることを確認。

```bash
pnpm --filter @vue-hono-aws-cdk/frontend build
```

`apps/frontend/dist/` にビルド成果物が生成されることを確認。

### Step 4: ドキュメント更新

`docs/state.md` の「開発中」2項目を「完了」に移動する。

## 意図的に除外するもの

| 除外項目 | 理由 |
|---------|------|
| Vue Router | 現時点では `/` のみ。`/items` 実装時に追加 |
| Tailwind CSS v4 | UI/UX設計タスク時に追加 |
| shadcn-vue | Tailwind に依存。同時に追加 |
| oxlint | state.md で「計画中」 |
| Pinia | 管理する状態がまだない |
| `components/` / `views/` ディレクトリ | App.vue 以外のコンポーネントがない |

## 検証方法

1. `pnpm --filter @vue-hono-aws-cdk/frontend dev` → ブラウザで「tocoop」表示を確認
2. `pnpm --filter @vue-hono-aws-cdk/frontend build` → `dist/index.html` と JS アセットが生成されることを確認
3. `vue-tsc -b` が型エラーなく通ることを確認（`build` スクリプトに含まれる）

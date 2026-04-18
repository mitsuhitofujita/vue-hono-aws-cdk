# Plan: ホームページにデザインを適用（未認証ビュー）

## Context

`docs/state.md` の "In Progress" 項目 "Apply design to the home page - Implement the unauthenticated view (Includes the Sign in with Google button)" を実施する。

現状、`apps/frontend/src/App.vue` はプレーンな `<h1>tocoop</h1>` のみ。`docs/html/home-unauthenticated.html` に完成されたデザインモックアップが存在するので、これを Vue コンポーネント化し、Tailwind CSS v4 をセットアップして適用する。

**スコープ外**（後続の Planned 項目）:
- 実際の Cognito 認証処理（ボタンは表示のみ、クリックしても何もしない）
- 認証済みビュー
- ルーティング（現状 `/` のみのため vue-router 不要）
- shadcn-vue の導入（ボタン 1 つのみ必要なので Tailwind プレーンで対応、後続ページで必要になった時に導入）

## 設計方針

1. **Tailwind CSS v4** を CSS-first 構成で導入（`tailwind.config.js` ではなく `@theme` ブロックで設定）
2. モックアップの HTML を忠実に Vue コンポーネントに移植
3. フッター（全ページ共通）は `AppFooter.vue` に分離し、将来の他ページ追加時に再利用
4. ホームページ本体は `HomeView.vue` に分離し、将来の認証状態による分岐や router 化に備える
5. カラーパレット・フォント設定は `main.css` の `@theme` にて一元化

## 変更対象ファイル

### 新規作成

- `apps/frontend/src/assets/main.css`
  - `@import "tailwindcss";`
  - `@theme` ブロックで primary/secondary カラー（50–900）、`--font-logo`、`--font-body` を定義
  - `body { font-family: var(--font-body); }`

- `apps/frontend/src/components/AppFooter.vue`
  - モックアップの `<footer>` をそのまま移植
  - `py-6 border-t border-stone-200`、中央寄せの "tocoop" テキスト

- `apps/frontend/src/views/HomeView.vue`
  - モックアップの `<main>` 部分（ロゴ、説明文、Sign In カード＋Google ボタン）を移植
  - Google SVG アイコンはインラインで保持
  - ボタンは `type="button"` のまま、`@click` ハンドラなし（認証実装は後続ステップ）

### 修正

- `apps/frontend/package.json`
  - devDependencies に `tailwindcss@^4` と `@tailwindcss/vite` を追加

- `apps/frontend/vite.config.ts`
  - `@tailwindcss/vite` プラグインを `plugins` 配列に追加

- `apps/frontend/index.html`
  - `<head>` に Google Fonts の preconnect と `DM Mono` + `Inter` のスタイルシート link を追加
  - `<body>` に `class="bg-stone-50 min-h-screen flex flex-col"` を設定（モックアップ準拠）

- `apps/frontend/src/main.ts`
  - `import "./assets/main.css";` を追加

- `apps/frontend/src/App.vue`
  - `<HomeView />` と `<AppFooter />` を縦並びで配置（`main` + `footer` 構造）
  - 既存の `<h1>tocoop</h1>` は削除

- `docs/state.md`
  - "Apply design to the home page > Implement the unauthenticated view" を "Completed" セクションに移動
  - "In Progress" を空にする（または次の Planned 項目から繰り上げるかは着手時に判断）

## カラーパレット（`@theme` で定義）

モックアップから正確に引用:

```css
@theme {
  --font-logo: "DM Mono", monospace;
  --font-body: "Inter", sans-serif;

  --color-primary-50:  #f4f7ed;
  --color-primary-100: #e6edda;
  --color-primary-200: #cedbb8;
  --color-primary-300: #afc48d;
  --color-primary-400: #93ad6a;
  --color-primary-500: #7a9650;
  --color-primary-600: #5e763d;
  --color-primary-700: #4a5c33;
  --color-primary-800: #3d4b2d;
  --color-primary-900: #354029;

  --color-secondary-50:  #faf8ed;
  --color-secondary-100: #f3efd3;
  --color-secondary-200: #e8dfa8;
  --color-secondary-300: #d9c974;
  --color-secondary-400: #ccb54c;
  --color-secondary-500: #bda03e;
  --color-secondary-600: #a37e33;
  --color-secondary-700: #835e2c;
  --color-secondary-800: #6d4d2b;
  --color-secondary-900: #5e4128;
}
```

Tailwind v4 は `--color-primary-700` を自動的に `primary-700` ユーティリティとして認識するため、モックアップの `text-primary-800` / `border-primary-700` などのクラス名がそのまま動作する。

## 検証手順

1. `pnpm install` で新規依存関係を追加
2. `pnpm --filter @vue-hono-aws-cdk/frontend dev` で開発サーバー起動（デフォルト `http://localhost:5173/`）
3. ブラウザで開き、`docs/html/home-unauthenticated.html` を別タブで開いて**視覚的に比較**:
   - ロゴ（二重枠の TOCOOP + 下のサブタイトル枠）の色・余白・ボーダー
   - 説明文 2 行の改行と文字色
   - Sign In カードの枠線・内側余白
   - Google ボタンのホバー時のボーダー色・テキスト色変化
   - フッター位置（画面下固定ではなく flex で下寄せ）
4. DM Mono / Inter フォントがロードされていることを DevTools Network タブで確認
5. レスポンシブ確認: DevTools でモバイル幅（375px 等）に切り替え、`max-w-sm` の中央寄せが正しく機能することを確認
6. `pnpm --filter @vue-hono-aws-cdk/frontend build` でビルド成功を確認
7. ビルド成果物の `dist/index.html` を直接開き、本番と同等のバンドルでも表示崩れがないことを確認

## 注意点

- Tailwind v4 は v3 と設定方法が大きく異なる（`tailwind.config.js` ではなく CSS での `@theme`）。モックアップは `cdn.tailwindcss.com`（v3 構文）だが、実装では v4 構文に変換する。ユーティリティクラス名自体（`bg-stone-50`、`text-primary-800` 等）は v4 でもそのまま動作する。
- `@tailwindcss/vite` は v4 公式の Vite プラグインで、PostCSS 設定は不要。
- 追加する Google Fonts の取得は CloudFront 経由ではないため、将来的にパフォーマンス最適化として self-hosting も検討余地あり（本タスクのスコープ外）。

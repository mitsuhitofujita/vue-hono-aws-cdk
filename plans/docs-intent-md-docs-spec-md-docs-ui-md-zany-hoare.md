# ホームページ認証 + 認証済みビュー実装

## Context

`docs/state.md` の「In Progress」にある以下2項目を実装する:

1. **Implement authentication on the home page** — Sign in with Google ボタンを有効化し、Cognito と連携する。Cognito Hosted UI は経由しないため、Amplify Auth の `signInWithRedirect({ provider: 'Google' })` を利用する。これにより Cognito は即 Google へリダイレクトし、ユーザー視点では Google の認証画面しか表示されない。
2. **Apply design to the home page (authenticated view)** — `docs/html/home-authenticated.html` のデザインを Vue テンプレートに移植し、認証状態に応じて切り替え表示する。

CDK 側には既に Cognito User Pool (`AuthStack`)、Google IdP、Cognito Domain、OAuth Authorization Code Grant 対応 Client が定義されており、CFN Output として `UserPoolId` / `UserPoolClientId` / `UserPoolDomainPrefix` が出力済み。コールバックURL には CloudFront のドメインと `http://localhost:5173/` が登録されているため、dev / prod どちらの origin からも同じ Client で認証が完結する。

## 実装対象ファイル

### 変更
- `apps/frontend/package.json` — `aws-amplify` を dependencies に追加
- `apps/frontend/env.d.ts` — `ImportMetaEnv` の型定義を拡張
- `apps/frontend/src/main.ts` — `Amplify.configure()` を呼び出し
- `apps/frontend/src/views/HomeView.vue` — 認証状態で未認証/認証済みビューを切り替え
- `docs/state.md` — 完了項目に移動

### 新規
- `apps/frontend/.env.example` — 必要な環境変数のサンプル
- `apps/frontend/src/lib/amplify.ts` — Amplify の configuration 生成関数 (env 変数の読み込みと検証)
- `apps/frontend/src/composables/useAuth.ts` — 認証状態 (`user`, `isAuthenticated`, `isLoading`) と `signInWithGoogle()` / `signOut()` を提供

## 詳細設計

### 1. 依存追加

`apps/frontend/package.json` の `dependencies` に以下を追加:

```json
"aws-amplify": "^6.x"
```

`pnpm install` は実装時に実行する (ただし `pnpm dev`/`cdk deploy` はユーザーが試すため、インストールのみに留める)。

### 2. 環境変数

CDK Output を手動で `.env.local` に転記する運用。自動同期は後続タスクで検討する (今は最小のトイルで進める)。

`apps/frontend/.env.example` を新規追加:

```
VITE_AWS_REGION=ap-northeast-1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_CLIENT_ID=
VITE_COGNITO_DOMAIN_PREFIX=
```

`env.d.ts` に型を追加:

```ts
interface ImportMetaEnv {
  readonly VITE_AWS_REGION: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_USER_POOL_CLIENT_ID: string;
  readonly VITE_COGNITO_DOMAIN_PREFIX: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Cognito Domain は `${prefix}.auth.${region}.amazoncognito.com` を組み立てる。
`redirectSignIn` / `redirectSignOut` は `window.location.origin + '/'` を使い、dev / prod 双方で同一コードを保つ (CDK 側で両方登録済み)。

### 3. `src/lib/amplify.ts`

`Amplify.configure()` の引数を構築する関数を置く。`main.ts` をシンプルに保つ目的。

```ts
import { Amplify } from "aws-amplify";

export function configureAmplify() {
  const region = import.meta.env.VITE_AWS_REGION;
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
  const domainPrefix = import.meta.env.VITE_COGNITO_DOMAIN_PREFIX;
  const redirectUrl = `${window.location.origin}/`;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain: `${domainPrefix}.auth.${region}.amazoncognito.com`,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [redirectUrl],
            redirectSignOut: [redirectUrl],
            responseType: "code",
          },
        },
      },
    },
  });
}
```

### 4. `src/composables/useAuth.ts`

Amplify Auth v6 の API (`signInWithRedirect`, `signOut`, `getCurrentUser`, `fetchUserAttributes`, `Hub`) をラップする。

- `user: Ref<{ displayName: string; picture?: string } | null>`
- `isAuthenticated: ComputedRef<boolean>`
- `isLoading: Ref<boolean>`
- `signInWithGoogle(): Promise<void>` — `signInWithRedirect({ provider: 'Google' })`
- `signOut(): Promise<void>`
- 初期化時に `getCurrentUser()` で現ユーザー判定、`Hub.listen('auth', ...)` で `signedIn` / `signedOut` / `signInWithRedirect_failure` を購読し state を更新
- Google から戻ってきた直後は URL に `?code=...` が付いており、Amplify 側が自動で code 交換を行う。`Hub` の `signedIn` を待って user を再取得する

表示名・画像は `fetchUserAttributes()` から `name` / `picture` を取得する。Google IdP 側の attributeMapping で `fullname` / `profilePicture` にマップされているため、Cognito の標準属性として返る。

モジュール内で単一のリアクティブ state を保持 (singleton) し、複数コンポーネントで参照しても同じ値を返す構成とする。

### 5. `HomeView.vue` の分岐

既存のロゴ/タイトル/説明文ブロックは共通部分として維持。`Sign In` カードと `Account` カードを `v-if="!isAuthenticated"` / `v-else` で切り替える。

- 未認証ビュー: 既存マークアップを流用し、`<button>` に `@click="signInWithGoogle"` を追加。`isLoading` 中は `disabled` に。
- 認証済みビュー: `docs/html/home-authenticated.html` (L77–114) のマークアップを Vue 化。プロフィール画像は `user.picture` があれば `<img>`、なければ既存のプレースホルダー SVG。`Display Name` に `user.displayName` をバインド。
  - `Items` ボタンは `<a href="/items">` のままにする (別タスクで `/items` ページを実装するまで実遷移は未実装でも HTML 上はリンクとして残す)。
  - `Sign Out` ボタンに `@click="signOut"` を追加。

初回表示時、`isLoading === true` の間は両ビューを出さずに空白にするか、極小のスピナーを出す (現状の shadcn-vue 未導入を踏まえ、シンプルな skeleton を入れる程度)。

### 6. `main.ts` の更新

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { configureAmplify } from "./lib/amplify";
import "./assets/main.css";

configureAmplify();
createApp(App).mount("#app");
```

### 7. `docs/state.md` の更新

- 「In Progress」の該当2項目を「Completed」へ移動
- 「In Progress」が空になるので次の候補 (Planned の先頭 "Backend resource provisioning" など) を In Progress に繰り上げるかは、判断を持ち越し (今タスクでは項目の移動のみ)

## 範囲外 (今回やらないこと)

- vue-router の導入 (Planned の Item list page 実装時に対応)
- Pinia の導入 (composable で十分)
- shadcn-vue の導入 (現状マークアップで間に合うため)
- `/items` ページの実装
- CDK Output から `.env.local` を自動生成する仕組み
- ホームページ以外のページ (仕様書 Pages セクションの他ページ)

## 検証手順

`pnpm dev` と `cdk deploy` はユーザーが試すため、コード変更までで止める。ユーザー側の検証で確認する項目:

1. `infra/cdk` を deploy し、CFN Output から `UserPoolId`, `UserPoolClientId`, `UserPoolDomainPrefix` を取得
2. `apps/frontend/.env.local` に値を設定 (AWS Region も明示)
3. `cd apps/frontend && pnpm install` で `aws-amplify` を入れる
4. `pnpm dev` で `http://localhost:5173/` にアクセス
5. 未認証状態で "Sign in with Google" をクリック → Google アカウント選択画面が直接表示されること (Cognito の UI が見えないこと)
6. 認証完了後、`http://localhost:5173/?code=...` に戻り、最終的に認証済みビュー (プロフィール画像 + Display Name + Items ボタン + Sign Out ボタン) が表示されること
7. "Sign Out" クリックで未認証ビューに戻ること
8. (任意) `pnpm build` → `cdk deploy` → CloudFront URL でも同じフローが動くこと

## 主要ファイルパス (実装時の参照用)

- `apps/frontend/src/views/HomeView.vue` — 既存マークアップあり、v-if で分岐させる
- `apps/frontend/src/assets/main.css` — Tailwind v4 `@theme` にカラー定義済み、追加不要
- `apps/frontend/src/main.ts` — Amplify.configure 呼び出し
- `infra/cdk/src/stacks/auth-stack.ts` — Cognito 側の設定 (変更不要、値の参照元として確認)
- `docs/html/home-authenticated.html` L77–114 — 認証済みビューのソース HTML
- `docs/html/home-unauthenticated.html` L77–94 — 未認証ビューの既存 HTML (HomeView に既に反映済み)

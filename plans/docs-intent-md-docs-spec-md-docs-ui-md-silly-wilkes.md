# Wire frontend to `/api/items` and render the designed item list page

## Context

`docs/state.md` lists one in-progress task: wire the SPA to `GET /api/items` and
render the response. Everything around it is already in place — the Hono Lambda
returns mocked items, CloudFront routes `/api/*` to the HTTP API, and the API is
gated by a Cognito JWT authorizer (`audience = userPoolClientId`). The frontend
stops at the home page; there is no router, no API client, and the
`/items` link in `HomeView.vue` is a plain `<a>` that does a full reload.

Per user decision in planning, the scope of this iteration also pulls in the
"Item list page implementation" task from `Planned`: instead of dumping JSON,
the new page matches `docs/html/item-list.html`. Pagination support is **not**
in scope (the API has no pagination); the pagination UI is rendered inert.

Outcome: signed-in users navigating to `/items` see a styled, mobile-first list
of items fetched from the real backend, with the request authorized by the
Cognito ID token. Unauthenticated visits to `/items` redirect home.

---

## Approach

Introduce `vue-router` with two routes (`/`, `/items`), a single API helper
that attaches the Cognito ID token, and a new `ItemsView` plus `AppHeader`
that mirror the mockup. The header is rendered conditionally per route via
route `meta`, since the home page intentionally has no header.

### Auth-token gotchas to keep in mind during implementation

- **Send the Cognito ID token, not the access token.** The HTTP API JWT
  authorizer's `jwtAudience` is the user pool *client* ID. ID tokens carry
  `aud == clientId`; access tokens carry `aud == userPoolId` and
  `client_id == clientId` (different claim). Sending the access token will
  always 401.
- **Amplify session is async on first paint.** `useAuth()`'s `isLoading`
  starts `true` and only flips to `false` after `refreshUser()` resolves.
  A naive guard reads `isAuthenticated.value` before that and bounces a
  signed-in user from `/items` on hard refresh. The guard below waits for
  `isLoading` to settle (with a safety timeout).
- **Defense in depth.** Even with the guard, a token can expire between the
  guard and the fetch. `fetchItems()` throws `ApiError(status: 401)`, which
  `ItemsView` catches and uses to `router.replace({ name: 'home' })`.

---

## File-by-file changes

### Create `apps/frontend/src/router/index.ts`

Route table + auth guard. Use Vue's `watch` (one-shot, with cleanup) rather
than polling.

```ts
import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth";

const HomeView = () => import("../views/HomeView.vue");
const ItemsView = () => import("../views/ItemsView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: false, showAppHeader: false },
    },
    {
      path: "/items",
      name: "items",
      component: ItemsView,
      meta: { requiresAuth: true, showAppHeader: true },
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading.value) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        stop();
        resolve();
      }, 3000);
      const stop = watch(isLoading, (loading) => {
        if (!loading) {
          clearTimeout(timeout);
          stop();
          resolve();
        }
      });
    });
  }

  return isAuthenticated.value ? true : { name: "home" };
});

export default router;
```

### Create `apps/frontend/src/lib/api.ts`

Single source for backend calls. Owns auth-header construction and envelope
parsing. `ApiError` lets callers branch on 401 specifically.

```ts
import { fetchAuthSession } from "aws-amplify/auth";

export interface Item {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { tokens } = await fetchAuthSession();
  const idToken = tokens?.idToken?.toString();
  if (!idToken) throw new ApiError("Not authenticated", 401);
  return { Authorization: `Bearer ${idToken}` };
}

export async function fetchItems(): Promise<Item[]> {
  const headers = await authHeader();
  const res = await fetch("/api/items", { headers });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { items?: Item[] };
  if (!body || !Array.isArray(body.items)) {
    throw new ApiError("Malformed response");
  }
  return body.items;
}
```

### Create `apps/frontend/src/components/AppHeader.vue`

Reads avatar from `useAuth()`. The avatar is a `<RouterLink to="/">` for now —
the slide-in nav drawer mandated by `spec.md` is deferred. `aria-label` says
"Back to home" so it stays truthful; switch to "Open navigation menu" when the
drawer lands.

```vue
<script setup lang="ts">
import { useAuth } from "../composables/useAuth";

const { user } = useAuth();
</script>

<template>
  <header class="border-b border-stone-200 bg-white">
    <div class="max-w-sm mx-auto px-4 py-3 flex items-center justify-between">
      <div class="border border-primary-700 px-3 py-1">
        <span
          class="font-logo font-medium text-base tracking-widest text-primary-800 uppercase"
          >tocoop</span
        >
      </div>
      <RouterLink
        to="/"
        aria-label="Back to home"
        class="w-9 h-9 rounded-full overflow-hidden border border-stone-200 hover:border-primary-400 transition-colors flex items-center justify-center bg-primary-100"
      >
        <img
          v-if="user?.picture"
          :src="user.picture"
          :alt="user.displayName"
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
        />
        <svg
          v-else
          class="w-5 h-5 text-primary-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </RouterLink>
    </div>
  </header>
</template>
```

### Create `apps/frontend/src/views/ItemsView.vue`

Four render branches: loading, error, empty, populated. Pagination UI is
rendered as `1 / 1` with both buttons disabled. Date formatted as `YYYY.MM`
to match the mockup (e.g., `2026.03`).

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchItems, ApiError, type Item } from "../lib/api";

const items = ref<Item[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const router = useRouter();

function formatYearMonth(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

onMounted(async () => {
  try {
    items.value = await fetchItems();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    errorMessage.value = e instanceof Error ? e.message : "Failed to load items";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <main class="flex-1 px-4 py-8">
    <div class="w-full max-w-sm mx-auto">
      <div class="mb-6">
        <h1
          class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2"
        >
          Items
        </h1>
      </div>

      <div class="mb-6 flex justify-end">
        <button
          type="button"
          disabled
          aria-disabled="true"
          class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          <span class="font-logo text-xs tracking-widest uppercase">Add</span>
        </button>
      </div>

      <div
        v-if="isLoading"
        class="border-t border-b border-stone-200 bg-white"
      >
        <div class="px-4 py-4 text-sm text-stone-400">Loading...</div>
      </div>

      <div
        v-else-if="errorMessage"
        role="alert"
        class="border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600"
      >
        {{ errorMessage }}
      </div>

      <ul
        v-else-if="items.length === 0"
        class="border-t border-b border-stone-200 bg-white"
      >
        <li class="px-4 py-4 text-sm text-stone-400">No items yet.</li>
      </ul>

      <ul
        v-else
        class="border-t border-b border-stone-200 divide-y divide-stone-100 bg-white"
      >
        <li v-for="item in items" :key="item.itemId">
          <a
            href="#"
            class="flex items-baseline justify-between px-4 py-4 hover:bg-primary-50 transition-colors"
          >
            <span class="text-sm text-stone-800 font-medium">{{ item.name }}</span>
            <span class="font-logo text-xs text-stone-500 tracking-wider">
              {{ formatYearMonth(item.purchaseYear, item.purchaseMonth) }}
            </span>
          </a>
        </li>
      </ul>

      <div class="mt-8 flex items-center justify-between">
        <button
          type="button"
          disabled
          aria-label="Previous page"
          class="w-10 h-10 rounded-full border border-stone-300 text-stone-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="font-logo text-xs tracking-widest text-stone-500">1 / 1</span>
        <button
          type="button"
          disabled
          aria-label="Next page"
          class="w-10 h-10 rounded-full border border-stone-300 text-stone-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </main>
</template>
```

### Modify `apps/frontend/src/App.vue`

Render `<RouterView />` and conditionally include the header.

```vue
<script setup lang="ts">
import { useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";

const route = useRoute();
</script>

<template>
  <AppHeader v-if="route.meta.showAppHeader" />
  <RouterView />
  <AppFooter />
</template>
```

### Modify `apps/frontend/src/main.ts`

Install router.

```ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { configureAmplify } from "./lib/amplify";
import "./assets/main.css";

configureAmplify();
createApp(App).use(router).mount("#app");
```

### Modify `apps/frontend/src/views/HomeView.vue`

Replace the anchor at line 115–120 with `<RouterLink>` (keeps the same
classes; just swaps the tag and `href`→`to`):

```vue
<RouterLink
  to="/items"
  class="block w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 text-sm font-medium tracking-wide uppercase transition-colors text-center"
>
  Items
</RouterLink>
```

### Modify `apps/frontend/package.json`

Add `vue-router` to `dependencies`:

```jsonc
"dependencies": {
  "aws-amplify": "^6.16.4",
  "vue": "^3.5.0",
  "vue-router": "^4.4.0"
}
```

Then `pnpm install` from the repo root.

### Modify `docs/state.md`

1. Move the In-Progress entry into `## Completed`, with the response shape
   updated to the envelope and a note about what was actually built:
   ```
   - Wire the frontend to the backend and render the response JSON on the page
       - Calls `GET /api/items` from the SPA and renders the returned items
       - Sends `Authorization: Bearer <idToken>` (Cognito ID token, matching the HTTP API JWT authorizer audience)
       - Response body shape (mock):
         ```json
         { "items": [
           { "itemId": "i1", "name": "エアコン", "purchaseYear": 2026, "purchaseMonth": 3 },
           { "itemId": "i2", "name": "冷蔵庫", "purchaseYear": 2025, "purchaseMonth": 11 },
           { "itemId": "i3", "name": "洗濯機", "purchaseYear": 2024, "purchaseMonth": 6 }
         ] }
         ```
   - Item list page implementation (initial)
       - `/items` route added via vue-router; auth-guarded (unauthenticated users redirect to `/`)
       - Layout matches `docs/html/item-list.html` (header with avatar, page header, ADD button, list, pagination UI)
       - Avatar slide-in nav menu deferred — the avatar currently links back to `/`
       - ADD button rendered but inert
       - Pagination UI rendered but inert (backend has no pagination yet); shows `1 / 1`
   ```
2. Empty out `## In Progress`.
3. Remove `- Item list page implementation` from `## Planned (not yet started)`.

---

## Critical files

- `apps/frontend/src/router/index.ts` (new)
- `apps/frontend/src/lib/api.ts` (new)
- `apps/frontend/src/views/ItemsView.vue` (new)
- `apps/frontend/src/components/AppHeader.vue` (new)
- `apps/frontend/src/App.vue` (modify)
- `apps/frontend/src/main.ts` (modify)
- `apps/frontend/src/views/HomeView.vue` (modify; one anchor → RouterLink)
- `apps/frontend/package.json` (add vue-router)
- `docs/state.md` (move in-progress → completed, drop list-page from planned)

Reuses (no changes):
- `apps/frontend/src/composables/useAuth.ts` — `useAuth()` already exposes
  `user`, `isAuthenticated`, `isLoading`. The router guard and AppHeader pull
  from it directly.
- `apps/frontend/src/components/AppFooter.vue` — kept across all routes via
  `App.vue`.
- `apps/frontend/src/assets/main.css` — primary/secondary palette + font
  tokens already match the mockup.

---

## Verification

1. **Install + typecheck**
   ```
   pnpm install
   pnpm --filter @vue-hono-aws-cdk/frontend build
   ```
   `vue-tsc -b` must succeed with no diagnostics.

2. **Local UI smoke test**
   ```
   pnpm --filter @vue-hono-aws-cdk/frontend dev
   ```
   - DevTools device emulation at 360 px width.
   - Sign in with Google on `/`. (Requires the dev origin to be in the
     Cognito user-pool client's callback URLs; otherwise verify only on the
     deployed CloudFront origin in step 4.)
   - Click **ITEMS**: must navigate client-side (no full reload). Loading
     state appears, then an error (`/api/*` is unreachable in `vite dev`).
   - Visual diff against `docs/html/item-list.html`: header logo + avatar,
     page title `ITEMS`, ADD button, list rows, pagination row. Footer is
     the existing `AppFooter`.

3. **Route-guard checks (still local)**
   - Signed out, navigate to `/items` directly → redirects to `/` after a
     short wait; no flash redirect for already-signed-in users.
   - Signed in, on `/items`, hard refresh → page stays on `/items`.

4. **End-to-end against deployed stack**
   ```
   cd infra/cdk && pnpm cdk deploy --all
   ```
   Then load the CloudFront URL.
   - Sign in with Google.
   - Click **ITEMS**.
   - DevTools → Network: request is `GET https://<cf-domain>/api/items`,
     header `Authorization: Bearer <jwt>`. Decode at jwt.io: payload should
     have `token_use: "id"` and `aud == VITE_COGNITO_USER_POOL_CLIENT_ID`.
   - Status `200`, body `{"items":[...]}`.
   - Three rows render: エアコン / 2026.03, 冷蔵庫 / 2025.11, 洗濯機 /
     2024.06. (Backend does not sort yet — order matches the array order in
     `apps/backend/src/app.ts`.)
   - Hard refresh `/items` directly: page loads (CloudFront SPA fallback)
     and stays put (guard waits for `isLoading`).

5. **Negative checks**
   - Clear Cognito tokens in DevTools → Application → reload `/items`.
     Expect redirect to `/`.
   - Open the deployed `/items` URL in an Incognito window. Expect redirect
     to `/`.

---

## Out of scope (do not include in this iteration)

- DynamoDB integration (kept in Planned).
- Real pagination (no `?page=` plumbing on either side; pagination UI is
  inert).
- Slide-in nav menu from the avatar.
- `/items/create`, `/items/:id`, `/items/:id/edit` routes.
- Wiring the ADD button to a destination.
- Client-side sorting (backend's responsibility once DynamoDB lands).
- oxlint integration.
- Backend feature tests / local DynamoDB harness.
- Component-architecture refactor (e.g., extracting `ItemListRow.vue`).
- 401 toast/banner UX — silent redirect is fine for now.
- CDK changes — none required; CloudFront `/api/*`, Cognito authorizer, and
  Lambda are already deployed.

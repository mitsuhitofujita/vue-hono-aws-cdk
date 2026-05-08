# Plan: Item Create page + ItemsView ADD button

## Context

`docs/state.md` lists two adjacent items as **In Progress**:

1. *Item create page implementation*
2. *Item list page feature additions — ADD button*

They are paired: the ADD button on `/items` is the only entry point to the
new create page. Today the ADD button is rendered as a disabled placeholder
in `ItemsView.vue`, and there is no `/items/create` route, no
`ItemCreateView`, no `POST /api/items` handler, and no `createItem`
repository function. The DynamoDB table, Lambda IAM (full CRUD), API
Gateway (`/api/{proxy+}`, ANY method, Cognito JWT authorizer), and Tailwind
v4 theme tokens are already provisioned, so this plan touches only
application code in `apps/frontend` and `apps/backend`.

Outcome: an authenticated user can navigate `/items` → ADD → fill the form
(name, purchase price, purchase month) → Apply → land back on `/items`
with the new row visible at the top.

## Critical files

- `apps/backend/src/items-repository.ts` — modify
- `apps/backend/src/app.ts` — modify
- `apps/frontend/src/lib/api.ts` — modify
- `apps/frontend/src/views/ItemCreateView.vue` — **new**
- `apps/frontend/src/router/index.ts` — modify
- `apps/frontend/src/views/ItemsView.vue` — modify
- Reference (read-only): `docs/html/item-create.html`, `docs/html/item-list.html`

## Type / contract changes

`Item` gains `purchasePrice: number` (yen, non-negative integer) on both
sides. Reads and writes stay symmetric: `listItemsByUser` projects and
validates `purchasePrice` like the other fields. Pre-existing rows without
`purchasePrice` will be filtered out by the validator — acceptable per
`docs/intent.md` (single-developer dev environment, freely recreatable).

```ts
// frontend (apps/frontend/src/lib/api.ts) and backend (apps/backend/src/items-repository.ts)
type Item = {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
};
```

`POST /api/items`

- Request: `{ name, purchaseYear, purchaseMonth, purchasePrice }` — all required.
- Response 200: `{ item: Item }` (includes server-generated `itemId`).
- Errors: `{ message }` with 400 (invalid body) / 401 (no sub claim).

## Backend

### `apps/backend/src/items-repository.ts`

- Import `PutCommand` alongside `QueryCommand` from `@aws-sdk/lib-dynamodb`.
- Import `randomUUID` from `node:crypto` (Lambda Node 20 ships it).
- Add `purchasePrice` to `Item`.
- Extend the per-row validator inside `listItemsByUser`:

  ```ts
  const purchasePrice = Number(raw.purchasePrice);
  if (
    typeof itemId !== "string" ||
    typeof name !== "string" ||
    !Number.isFinite(purchaseYear) ||
    !Number.isFinite(purchaseMonth) ||
    !Number.isFinite(purchasePrice)
  ) continue;
  items.push({ itemId, name, purchaseYear, purchaseMonth, purchasePrice });
  ```

- Add:

  ```ts
  export type CreateItemInput = {
    name: string;
    purchaseYear: number;
    purchaseMonth: number;
    purchasePrice: number;
  };

  export async function createItem(
    userId: string,
    input: CreateItemInput,
  ): Promise<Item> {
    const itemId = randomUUID();
    const item: Item = { itemId, ...input };
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: { userId, ...item },
      }),
    );
    return item;
  }
  ```

  Stored shape: `{ userId, itemId, name, purchaseYear, purchaseMonth, purchasePrice }`,
  matching the existing partition key `userId` / sort key `itemId`.

### `apps/backend/src/app.ts`

- Extract a small `getUserSub(c)` helper local to this file (the inline cast
  is about to repeat — one helper, no new file).

  ```ts
  import type { Context } from "hono";

  function getUserSub(c: Context<{ Bindings: Bindings }>): string | undefined {
    const claims = (
      c.env?.event as
        | { requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } } }
        | undefined
    )?.requestContext?.authorizer?.jwt?.claims;
    return typeof claims?.sub === "string" ? claims.sub : undefined;
  }
  ```

- Replace the inline cast in the existing `GET` handler with `getUserSub(c)`.
- Add the POST handler:

  ```ts
  app.post("/api/items", async (c) => {
    const sub = getUserSub(c);
    if (!sub) return c.json({ message: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => null) as
      | { name?: unknown; purchaseYear?: unknown; purchaseMonth?: unknown; purchasePrice?: unknown }
      | null;
    if (!body) return c.json({ message: "Invalid JSON" }, 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const purchaseYear = Number(body.purchaseYear);
    const purchaseMonth = Number(body.purchaseMonth);
    const purchasePrice = Number(body.purchasePrice);

    if (
      name.length === 0 ||
      !Number.isInteger(purchaseYear) || purchaseYear < 1900 || purchaseYear > 9999 ||
      !Number.isInteger(purchaseMonth) || purchaseMonth < 1 || purchaseMonth > 12 ||
      !Number.isInteger(purchasePrice) || purchasePrice < 0
    ) {
      return c.json({ message: "Invalid input" }, 400);
    }

    const item = await createItem(sub, { name, purchaseYear, purchaseMonth, purchasePrice });
    return c.json({ item }, 200);
  });
  ```

- Update the import to `import { createItem, listItemsByUser } from "./items-repository.js";`.

## Frontend

### `apps/frontend/src/lib/api.ts`

- Add `purchasePrice` to `Item`.
- Add and export:

  ```ts
  export interface CreateItemInput {
    name: string;
    purchaseYear: number;
    purchaseMonth: number;
    purchasePrice: number;
  }

  export async function createItem(input: CreateItemInput): Promise<Item> {
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    const res = await fetch("/api/items", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    const body = (await res.json()) as { item?: Item };
    if (!body || !body.item || typeof body.item.itemId !== "string") {
      throw new ApiError("Malformed response");
    }
    return body.item;
  }
  ```

  Mirrors `fetchItems`: `authHeader()` → fetch → `ApiError` on non-OK → shape check.

### New view: `apps/frontend/src/views/ItemCreateView.vue`

Style and structure follow `docs/html/item-create.html`, swapped to Vue 3
`<script setup>` and the existing `--color-primary-*` / `font-logo`
Tailwind v4 tokens already in `apps/frontend/src/assets/main.css`.
`AppHeader` and `AppFooter` are rendered globally by `App.vue` via the
`showAppHeader` route meta — this view should NOT include them itself.

Skeleton:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError, createItem } from "../lib/api";

const router = useRouter();

// Default purchase date to current YYYY-MM
const today = new Date();
const defaultMonth =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const name = ref("");
const purchaseDate = ref(defaultMonth);            // <input type="month"> -> "YYYY-MM"
const purchasePrice = ref<number | null>(null);

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

async function onSubmit() {
  errorMessage.value = null;

  const trimmed = name.value.trim();
  if (trimmed.length === 0) { errorMessage.value = "Name is required"; return; }
  const ym = parseYearMonth(purchaseDate.value);
  if (!ym) { errorMessage.value = "Purchase date is required"; return; }
  const price = purchasePrice.value;
  if (price === null || !Number.isInteger(price) || price < 0) {
    errorMessage.value = "Purchase price must be a non-negative integer";
    return;
  }

  isSubmitting.value = true;
  try {
    await createItem({
      name: trimmed,
      purchaseYear: ym.year,
      purchaseMonth: ym.month,
      purchasePrice: price,
    });
    void router.push({ name: "items" });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    errorMessage.value = e instanceof Error ? e.message : "Failed to create item";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="flex-1 px-4 py-8">
    <div class="w-full max-w-sm mx-auto">
      <div class="mb-6">
        <h1 class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2">
          Item Create
        </h1>
      </div>

      <form @submit.prevent="onSubmit">
        <div class="bg-white border-t border-b border-stone-200 px-4 py-4">
          <label for="item-name" class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2">Name</label>
          <input
            id="item-name" v-model="name" type="text" required placeholder="エアコン"
            class="w-full bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none text-base text-stone-800 font-medium py-1 placeholder:text-stone-300"
          />
        </div>

        <div class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4">
          <label for="purchase-price" class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2">Purchase Price</label>
          <div class="flex items-baseline gap-2">
            <span class="font-logo text-base text-stone-500">¥</span>
            <input
              id="purchase-price" v-model.number="purchasePrice"
              type="number" inputmode="numeric" min="0" step="1" required placeholder="100000"
              class="flex-1 bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none font-logo text-base text-stone-800 tracking-wider py-1 placeholder:text-stone-300 text-right"
            />
          </div>
        </div>

        <div class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4">
          <label for="purchase-date" class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2">Purchase Date</label>
          <input
            id="purchase-date" v-model="purchaseDate" type="month" required
            class="w-full bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none font-logo text-base text-stone-800 tracking-wider py-1"
          />
        </div>

        <div v-if="errorMessage" role="alert" class="mt-6 border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600">
          {{ errorMessage }}
        </div>

        <div class="mt-8 flex justify-end">
          <button
            type="submit" :disabled="isSubmitting"
            class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="font-logo text-xs tracking-widest uppercase">Apply</span>
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
```

### `apps/frontend/src/router/index.ts`

Insert before the catch-all redirect (the catch-all must remain the last
entry):

```ts
const ItemCreateView = () => import("../views/ItemCreateView.vue");

// in routes array:
{
  path: "/items/create",
  name: "items-create",
  component: ItemCreateView,
  meta: { requiresAuth: true, showAppHeader: true },
},
```

The existing `beforeEach` guard (auth check via `useAuth`) handles
gating — no other router change is needed. `/items` and `/items/create`
do not collide because they are both literal paths.

### `apps/frontend/src/views/ItemsView.vue`

Replace the placeholder `<button disabled aria-disabled="true">…Add…</button>`
inside the `<div class="mb-6 flex justify-end">` block with a `RouterLink`.
Keep every visual class so styling is unchanged; drop only the disabled
attributes and the `disabled:` utility classes.

```vue
<RouterLink
  :to="{ name: 'items-create' }"
  class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors"
>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M12 4v16m8-8H4"/>
  </svg>
  <span class="font-logo text-xs tracking-widest uppercase">Add</span>
</RouterLink>
```

`RouterLink` is globally registered by vue-router; no additional import is
needed in `<script setup>`.

## Sequencing

1. Backend: extend `Item`, extend `listItemsByUser` validator, add
   `createItem` in `items-repository.ts`.
2. Backend: extract `getUserSub`, add `POST /api/items` in `app.ts`.
   `pnpm --filter @vue-hono-aws-cdk/backend run typecheck`.
3. Frontend: extend `Item` and add `createItem` in `lib/api.ts`.
4. Frontend: create `ItemCreateView.vue`.
5. Frontend: register the route in `router/index.ts`.
6. Frontend: swap the ADD placeholder to `RouterLink` in `ItemsView.vue`.
   `pnpm --filter @vue-hono-aws-cdk/frontend run build`.
7. Deploy: `pnpm deploy` (root script — builds the frontend and runs
   `cdk deploy --all`). The Lambda code update picks up `POST /api/items`;
   no infra change is needed.

## Verification

End-to-end against the deployed environment (the local backend `dev.ts`
does not provide JWT claims, so any local POST returns 401 — useful only
for routing/JSON smoke tests, not full auth flow):

1. Type checks: `pnpm --filter @vue-hono-aws-cdk/backend run typecheck`
   and `pnpm --filter @vue-hono-aws-cdk/frontend run build`.
2. Deploy with `pnpm deploy`.
3. On the deployed CloudFront URL: sign in with Google → `/items` →
   confirm ADD button is enabled and styled like the mockup → click ADD →
   `/items/create` loads with header/footer and an empty form (purchase
   date defaulted to current month).
4. Submit blank name → inline error shown, no network request.
5. Submit price `-1` → inline error.
6. Submit valid input (e.g. `エアコン`, `100000`, `2026-05`) → returns
   to `/items` with the new row at the top (descending sort by purchase
   date).
7. Optional: in the AWS console, scan the DynamoDB table to confirm the
   new record contains `userId`, `itemId`, `name`, `purchaseYear`,
   `purchaseMonth`, `purchasePrice`.
8. Token-expiry path: clear `idToken` in browser storage → submit form →
   redirect to `/`.

## Out of scope

- Avatar/navigation menu in the header.
- Pagination, sorting controls, and item links on `ItemsView`.
- Item Detail page (`/items/{itemId}`), Edit page, Delete flow.
- Disposal date input (belongs to the Edit page per `spec.md`).
- `PUT /api/items/:id` and `DELETE /api/items/:id`.
- Linter integration (oxlint), unit / feature / E2E automated tests.
- shadcn-vue, zod, or any new dependency.
- CDK changes — IAM, API Gateway routes, table schema all already cover
  the create flow.
- Cosmetic `appearance: none` on native input chrome from the mockup.

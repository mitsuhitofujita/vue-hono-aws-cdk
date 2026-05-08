# Item Detail Page Implementation

## Context

`docs/state.md` lists two items under **In Progress**:

- Item detail page implementation
- Navigation from the item list page to the item detail page (browser back is sufficient; no in-app back navigation)

Completing these closes the read-side of the core flow (list → detail) so the user can verify a stored item's name, purchase price, purchase date, and the headline metric — *cost per month* (the application's purpose, per `docs/intent.md`). Edit/delete and disposal-date support remain "Planned" and are explicitly out of scope.

Two design decisions confirmed with the user:

1. **Detail data source**: add a new `GET /api/items/:id` endpoint rather than reusing `GET /api/items` and finding by id client-side. This keeps deep-link/refresh efficient and avoids coupling the detail page to list state. `docs/spec.md`'s REST API table must be updated to match.
2. **Disposal date**: not in scope here. The backend `Item` type has no disposal fields and DynamoDB does not store them yet. Cost per month is always calculated against today's year/month. Disposal will be added when the edit page is implemented (next planned task per `state.md`).

## Backend changes

### `apps/backend/src/items-repository.ts`

Add a single-key lookup helper next to `listItemsByUser` / `createItem`:

```ts
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function getItemForUser(
  userId: string,
  itemId: string,
): Promise<Item | null> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { userId, itemId },
    }),
  );
  const raw = result.Item;
  if (!raw) return null;

  const name = raw.name;
  const purchaseYear = Number(raw.purchaseYear);
  const purchaseMonth = Number(raw.purchaseMonth);
  const purchasePrice = Number(raw.purchasePrice);
  if (
    typeof name !== "string" ||
    !Number.isFinite(purchaseYear) ||
    !Number.isFinite(purchaseMonth) ||
    !Number.isFinite(purchasePrice)
  ) {
    return null;
  }
  return { itemId, name, purchaseYear, purchaseMonth, purchasePrice };
}
```

Notes:

- Use `GetCommand` (point lookup with the full composite key), not `QueryCommand`. The table key is `userId` (PK) + `itemId` (SK) — both are known.
- Defensive parsing matches `listItemsByUser`'s shape; any malformed record returns `null` (treated as not found).

### `apps/backend/src/app.ts`

Register the new handler. Wire `getItemForUser` into the existing import.

```ts
app.get("/api/items/:id", async (c) => {
  const sub = getUserSub(c);
  if (!sub) return c.json({ message: "Unauthorized" }, 401);

  const itemId = c.req.param("id");
  const item = await getItemForUser(sub, itemId);
  if (!item) return c.json({ message: "Not found" }, 404);

  return c.json({ item });
});
```

- Mirrors the existing `getUserSub` 401 pattern.
- `:id` is matched as `c.req.param("id")` (Hono).
- Authorization is implicit: lookup is scoped to the caller's `userId`, so other users' items return 404.

## Frontend changes

### `apps/frontend/src/lib/api.ts`

Add `fetchItem` next to `fetchItems`. Surface 404 as `ApiError(status: 404)` so the view can render a "not found" state without retry/log noise.

```ts
export async function fetchItem(itemId: string): Promise<Item> {
  const headers = await authHeader();
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    headers,
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { item?: Item };
  if (!body || !body.item || typeof body.item.itemId !== "string") {
    throw new ApiError("Malformed response");
  }
  return body.item;
}
```

### `apps/frontend/src/router/index.ts`

Add a lazy import and route entry for the detail view, before the catch-all redirect:

```ts
const ItemDetailView = () => import("../views/ItemDetailView.vue");

// inside routes:
{
  path: "/items/:itemId",
  name: "items-detail",
  component: ItemDetailView,
  meta: { requiresAuth: true, showAppHeader: true },
},
```

### `apps/frontend/src/views/ItemDetailView.vue` (new)

Mirrors `ItemsView.vue` for layout/header, follows `ItemCreateView.vue`'s loading/error/auth patterns.

Key behaviors:

- `useRoute().params.itemId` → call `fetchItem(itemId)` in `onMounted`.
- Loading / error / not-found / loaded states (display "Item not found" inside the same outline-style container if `ApiError.status === 404`).
- 401 → `router.replace({ name: "home" })` (matches `ItemsView.vue`).
- Reuse `formatYearMonth(year, month)` (it is currently a local function in `ItemsView.vue`; duplicate it here rather than refactoring — frontend componentization is an explicit "Planned" task).
- **Cost-per-month** computed inline:

```ts
function monthsInOperation(
  purchaseYear: number,
  purchaseMonth: number,
  refYear: number,
  refMonth: number,
): number {
  const diff = (refYear - purchaseYear) * 12 + (refMonth - purchaseMonth) + 1;
  return diff < 1 ? 1 : diff; // future-dated purchase → display Month 1
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("en-US")}`;
}
```

- Reference month uses `new Date()` at component mount: `const now = new Date(); const refYear = now.getFullYear(); const refMonth = now.getMonth() + 1;`
- `costPerMonth = Math.floor(purchasePrice / months)`. The intent.md example (100,000 over 3 months → 33,333) confirms truncation.
- Render the highlighted box from `docs/html/item-detail.html`: label "Cost per Month", large value, sublabel `${refYear}.${pad(refMonth)} / Month ${months}`.
- The Edit button from the mockup is a placeholder: render it as visually identical, but without a `to`/handler yet (or stub it as a `disabled` state). The edit page is "Planned"; do not link to a non-existent route. Decision: render a **disabled** button so the design intent is visible but it cannot be clicked.

Markup baseline: copy the structure from `docs/html/item-detail.html` (`<main class="flex-1 px-4 py-8">`, max-w-sm container, the Name block, the `dl` with Purchase Price / Purchase Date, the highlighted Cost-per-Month box, the Edit button row). The global header and footer come from `App.vue` via `AppHeader` / `AppFooter` plus `meta.showAppHeader` — do not re-add them here.

### `apps/frontend/src/views/ItemsView.vue`

Replace the placeholder `<a href="#">` (line 90) with a `RouterLink`. Keep all classes identical so the visual treatment does not change.

```vue
<RouterLink
  :to="{ name: 'items-detail', params: { itemId: item.itemId } }"
  class="flex items-baseline justify-between px-4 py-4 hover:bg-primary-50 transition-colors"
>
  <!-- existing inner content -->
</RouterLink>
```

## Documentation updates

### `docs/spec.md`

Add a row to the REST API Endpoints table (between the GET-list and POST-create rows):

| Method | Path | Description |
|---|---|---|
| GET | `/api/items/:id` | Get a single item |

### `docs/state.md`

After implementation lands, move both **In Progress** entries to **Completed**:

- "Item detail page implementation"
- "Navigation from the item list page to the item detail page" (with the existing sub-bullet about browser back)

`In Progress` becomes empty until the next task picks up.

## Files to modify

- `apps/backend/src/items-repository.ts` — add `getItemForUser`, import `GetCommand`.
- `apps/backend/src/app.ts` — add `GET /api/items/:id` handler, import `getItemForUser`.
- `apps/frontend/src/lib/api.ts` — add `fetchItem`.
- `apps/frontend/src/router/index.ts` — add the `/items/:itemId` route + lazy import.
- `apps/frontend/src/views/ItemDetailView.vue` — new file.
- `apps/frontend/src/views/ItemsView.vue` — swap the placeholder `<a>` for `RouterLink`.
- `docs/spec.md` — add the GET-by-id endpoint row.
- `docs/state.md` — move In Progress entries to Completed.

## Out of scope (explicit)

- Disposal year/month on `Item` (backend type, DynamoDB record, repository, frontend type, UI). Deferred to the edit-page task.
- Edit button wiring on the detail page. Render as a disabled visual placeholder.
- Pagination, sorting, account menu on the list page (already "Planned").
- Component extraction for the duplicated page-header / format helpers ("Frontend refactoring with component architecture in mind" is "Planned").
- zod-based input validation ("Planned").

## Verification

End-to-end check against a deployed dev environment (preferred — `pnpm dev` for backend talks to real DynamoDB only; CDK already wires the table for `dev-`).

1. **Build & deploy** (or run frontend `pnpm dev` against deployed backend):
   - `pnpm --filter backend build` (lambda), `cdk deploy` for the affected stacks.
   - `pnpm --filter frontend dev` for fast UI iteration; or `pnpm deploy:web` for full pipeline.
2. **Happy path**:
   - Sign in via Google on `/`.
   - Visit `/items` — confirm at least one item is listed (create one via `/items/create` first if needed).
   - Tap an item → URL becomes `/items/<itemId>`, page renders Name, Purchase Price (¥-formatted), Purchase Date (`YYYY.MM`), and a Cost per Month box showing `¥<floor(price/months)>` with the sublabel `<refYear>.<refMonth> / Month <n>`.
   - For an item purchased 2026-03 (n=3) at 100,000 JPY, against today (2026-05), the box must show `¥33,333` and `2026.05 / Month 3`. This matches the worked example in `docs/intent.md`.
3. **Deep link / refresh**:
   - Reload the detail URL directly. Auth guard kicks in; after sign-in completes, the page fetches the item and renders without first visiting `/items`.
4. **Not found**:
   - Visit `/items/does-not-exist`. Backend returns 404; view renders a "not found" message inside the standard outlined container (no error console spam).
5. **Auth failure**:
   - With an expired/missing token, the page must redirect to `/` (same behavior as `ItemsView.vue`).
6. **Browser back**:
   - From detail view, browser back returns to `/items` with prior scroll position preserved (no in-app back button required, per `state.md`).
7. **Other-user isolation** (if a second test account is available): create an item as user A, attempt to fetch it as user B — must return 404.

No automated tests are added in this task. Backend feature tests against local DynamoDB are listed under "Planned (not to start yet)" in `state.md`; following that ordering, manual verification suffices for now.

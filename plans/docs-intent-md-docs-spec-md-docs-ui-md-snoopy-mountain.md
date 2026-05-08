# Plan: Item Edit Page, Disposal Date Support, and List Disposal Indicator

## Context

`docs/state.md` "In Progress" lists three tightly intertwined items:

1. Item edit page (`/items/:itemId/edit`).
2. Item detail page — disposal date support; when disposal is set, the average fixed cost is fixed at the value computed as of the disposal month.
3. Item list page — indicate whether each item has been disposed of.

Each item depends on a shared change: the `Item` model must gain optional disposal year/month fields, the backend must expose `PUT` and `DELETE` for `/api/items/:id` (currently only `GET` and `POST` exist), and the frontend type and views must propagate disposal-aware behavior. The `ItemDetailView` already has a disabled Edit button waiting for this work (`apps/frontend/src/views/ItemDetailView.vue:161-180`). Mockups for all three end states already exist under `docs/html/`. CDK is unaffected — DynamoDB is schemaless beyond `userId`/`itemId`, and the Lambda execution role already has `UpdateItem`/`DeleteItem` permissions (`infra/cdk/src/stacks/backend-data-access-stack.ts:29-36`).

## Decisions (confirmed with user)

- Delete UX on the edit page: inline two-step confirmation (no native `confirm()`). Default state shows the red "Delete" button; clicking reveals a warning block with "Cancel" and "Confirm Delete".
- Disposal validation: `disposalYM >= purchaseYM`, enforced on both frontend and backend.
- Clearing disposal: client omits `disposalYear`/`disposalMonth` from the PUT body. The backend interprets absence as "remove" and issues a DynamoDB `REMOVE` for those attributes.

## Backend changes

### `apps/backend/src/items-repository.ts`

- Extend `Item` and add `UpdateItemInput`:
  ```ts
  export type Item = {
    itemId: string;
    name: string;
    purchaseYear: number;
    purchaseMonth: number;
    purchasePrice: number;
    disposalYear?: number;
    disposalMonth?: number;
  };
  export type UpdateItemInput = {
    name: string;
    purchaseYear: number;
    purchaseMonth: number;
    purchasePrice: number;
    disposalYear?: number;
    disposalMonth?: number;
  };
  ```
- In `listItemsByUser` and `getItemForUser`, read disposal fields only when both `disposalYear` and `disposalMonth` are finite integers; include them on the returned object only in that case.
- Add `updateItem(userId, itemId, input): Promise<Item>` using `UpdateCommand` from `@aws-sdk/lib-dynamodb`:
  - Always `SET` `name`, `purchaseYear`, `purchaseMonth`, `purchasePrice`.
  - If both `disposalYear` and `disposalMonth` are present in `input`, `SET` them; otherwise `REMOVE` both.
  - `ConditionExpression: "attribute_exists(itemId)"` so an unknown id throws a typed `ItemNotFoundError` (or a sentinel returned to the handler).
  - Use `ReturnValues: "ALL_NEW"` and rebuild the typed `Item` from the response.
- Add `deleteItem(userId, itemId): Promise<boolean>` using `DeleteCommand` with `ReturnValues: "ALL_OLD"`. Return `true` if `Attributes` came back, `false` otherwise (so the handler can map to 404).

### `apps/backend/src/app.ts`

- Extract a small validator that returns `{ name, purchaseYear, purchaseMonth, purchasePrice, disposalYear?, disposalMonth?, error? }` from a parsed body. The existing inline validation in POST (`apps/backend/src/app.ts:78-95`) is duplicated by PUT — share it.
- New rules in the validator:
  - `disposalYear` and `disposalMonth` must come together (both present and integer-coercible, or both absent). Mixed → 400.
  - When present: `disposalYear` in `[1900, 9999]`, `disposalMonth` in `[1, 12]`.
  - When present: `disposalYear*12 + disposalMonth >= purchaseYear*12 + purchaseMonth`. Reject otherwise as 400 with a clear message.
- Add `app.put("/api/items/:id", ...)`:
  - Auth via `getUserSub` (`apps/backend/src/app.ts:16-27`).
  - Parse JSON, validate. Call `updateItem`. On `ItemNotFoundError`, return 404. On success, return `{ item }` 200.
- Add `app.delete("/api/items/:id", ...)`:
  - Auth via `getUserSub`. Call `deleteItem`. On `false`, return 404. On success, return `c.body(null, 204)`.

No CDK changes are required.

## Frontend API client

### `apps/frontend/src/lib/api.ts`

- Extend `Item` with optional `disposalYear?` / `disposalMonth?`. Add `UpdateItemInput` mirroring the backend shape.
- Add `updateItem(itemId: string, input: UpdateItemInput): Promise<Item>` — PUT, JSON body, parse `{ item }`. Reuse `authHeader()` and `ApiError`.
- Add `deleteItem(itemId: string): Promise<void>` — DELETE, expects 204; throw `ApiError` on non-2xx.
- Both functions encode the id with `encodeURIComponent` to match the existing `fetchItem` pattern (`apps/frontend/src/lib/api.ts:47`).

## Frontend router

### `apps/frontend/src/router/index.ts`

- Add lazy import: `const ItemEditView = () => import("../views/ItemEditView.vue");`.
- Add route after `items-detail`:
  ```ts
  {
    path: "/items/:itemId/edit",
    name: "items-edit",
    component: ItemEditView,
    meta: { requiresAuth: true, showAppHeader: true },
  }
  ```

## Frontend views

### `apps/frontend/src/views/ItemEditView.vue` (new)

- Structure mirrors `ItemCreateView.vue`. Inputs: `name`, `purchasePrice`, `purchaseDate` (`type=month`), `disposalDate` (`type=month`, optional, may be empty).
- On mount: read `route.params.itemId`; call `fetchItem(itemId)`. Pre-fill name, price, `purchaseDate` (`YYYY-MM`), and `disposalDate` (`YYYY-MM` or `""`). Handle 401 (redirect home) and 404 (show "Item not found") like `ItemDetailView`.
- Submit:
  - `parseYearMonth` purchase and (if non-empty) disposal.
  - Validate disposal complete-or-empty and `disposalYM >= purchaseYM`. Show `errorMessage` on failure.
  - Call `updateItem(itemId, input)`; omit `disposalYear`/`disposalMonth` from `input` when disposal date input is empty.
  - On success: `router.push({ name: "items-detail", params: { itemId } })`.
- Inline delete flow (per `docs/html/item-edit.html` "Danger Zone"):
  - State: `confirmingDelete = ref(false)`, `isDeleting = ref(false)`.
  - Default UI: red "Delete" button.
  - On click → set `confirmingDelete = true` to reveal a small panel with warning copy and two buttons: "Cancel" (back to default) and "Confirm Delete" (red, primary action).
  - Confirm → call `deleteItem(itemId)`, on success `router.push({ name: "items" })`. On error, surface in `errorMessage` and reset `isDeleting`.
- Visual conventions copied from existing views: `font-logo`, primary palette borders/buttons, stone-200 dividers, max-w-sm wrapper.

### `apps/frontend/src/views/ItemDetailView.vue` (modify)

Reference: `docs/html/item-disposed-detail.html`.

- Compute `isDisposed = !!(item.value?.disposalYear && item.value?.disposalMonth)`.
- Replace `refYear/refMonth`-based cost calc with a derived reference month:
  - When `isDisposed`: `(item.disposalYear, item.disposalMonth)`.
  - Otherwise: current year/month.
- `monthsInOperation` already takes `purchaseYear/Month` and uses `refYear/refMonth`; refactor to accept the reference year/month so the same function works for both.
- Template changes:
  - Name block: when `isDisposed`, render the inline "Disposed" badge to the right of the name and switch the name text class to `text-stone-500`.
  - Attributes `<dl>`: append a "Disposal Date" row (`formatYearMonth(disposalYear, disposalMonth)`) when `isDisposed`.
  - Cost block: when `isDisposed`, switch outer classes to `border-2 border-stone-400 bg-stone-100`, header colors to stone, add a "Final" badge next to the title, and append "(disposed)" to the month label.
  - Edit button: replace the disabled `<button>` with `<RouterLink :to="{ name: 'items-edit', params: { itemId: item.itemId } }">` keeping the same classes (drop `disabled` styles).

### `apps/frontend/src/views/ItemsView.vue` (modify)

Reference: `docs/html/item-list.html` lines 151-167.

- For each `<li>`, compute `isDisposed = !!(item.disposalYear && item.disposalMonth)`.
- When `isDisposed`:
  - Wrap name and badge in a flex span; render the "Disposed" badge after the name.
  - Switch name and date text classes to `text-stone-400`.

## Critical files

- `apps/backend/src/items-repository.ts` — Item type, `updateItem`, `deleteItem`.
- `apps/backend/src/app.ts` — `PUT`/`DELETE` handlers, shared validator.
- `apps/frontend/src/lib/api.ts` — Item type, `updateItem`, `deleteItem`.
- `apps/frontend/src/router/index.ts` — new `items-edit` route.
- `apps/frontend/src/views/ItemEditView.vue` — NEW.
- `apps/frontend/src/views/ItemDetailView.vue` — disposal-aware rendering and cost calc, enable Edit link.
- `apps/frontend/src/views/ItemsView.vue` — disposed badge and muted style.

## Reused utilities

- Auth: `fetchAuthSession` + `authHeader()` (`apps/frontend/src/lib/api.ts:27`).
- `getUserSub()` (`apps/backend/src/app.ts:16`).
- `ApiError` and the 401 → home redirect pattern (`apps/frontend/src/views/ItemDetailView.vue:57-60`).
- DynamoDB `documentClient` (`apps/backend/src/items-repository.ts:30`).
- `formatYearMonth` and `parseYearMonth` patterns from existing views — keep inline duplicates in `ItemEditView` for symmetry with `ItemCreateView`; do not pre-extract.

## Verification

Local frontend (`pnpm --filter frontend dev`):

1. Sign in. Create a new item without disposal — list and detail render as today.
2. From the detail page, click Edit (now enabled). Set a disposal date in the past, Apply.
   - Detail page: name shows "Disposed" badge, cost panel switches to muted/Final styling, cost equals `floor(price / monthsBetween(purchase, disposal))`, "Disposal Date" row shows.
   - List page: that row is muted with the "Disposed" badge.
3. Edit again, clear the disposal field, Apply. Detail and list revert to active styling; cost-per-month resumes using current month as reference.
4. Edit, attempt to set disposal earlier than purchase — frontend shows error and does not submit.
5. From the edit page, click Delete → inline confirmation appears. Cancel collapses it. Confirm deletes and redirects to `/items`; item is gone.
6. Manual API check via `curl` (or DevTools) for parity:
   - `PUT /api/items/{id}` with `{ disposalYear: 2024, disposalMonth: 1 }` for an item purchased in `2026-03` → 400.
   - `DELETE /api/items/{unknown}` → 404.

Type and build:

- `pnpm -r build` (or equivalent root script) — backend `tsc` and frontend `vue-tsc`/Vite both succeed.

End-to-end (deployed): redeploy backend Lambda (`cdk deploy <BackendStack>`) since handlers changed; static frontend redeploys via `cdk deploy <DistributionAssociation>` or whichever stack syncs S3.

## Follow-up housekeeping (after implementation)

- Move the three "In Progress" bullets in `docs/state.md` to "Completed".
- No additional docs/learnings entry expected; nothing here is non-obvious enough to warrant `docs/learnings.md`.

# Introduce a 404 Error Page

## Context

Move the **Error page design exploration** item, currently listed under "In Progress" in `docs/state.md`, into the implementation phase.

Current behavior:

- When a user accesses a non-existent item ID, or an item ID that does not belong to them, the API already returns `404` (`apps/backend/src/app.ts:147, 194-196, 210`). Because the DynamoDB primary key is a composite of `userId + itemId`, requesting another user's item ID also resolves to `null` → `404`, which avoids leaking the existence of the resource.
- On the frontend, however, `ItemDetailView` / `ItemEditView` only set a `notFound` flag and render an inline `Item not found.` message inside the page. There is no dedicated error page.
- The router catch-all (`/:pathMatch(.*)*`) unconditionally redirects to the home page, so when a user lands on a non-existent URL (e.g. due to a typo) they are given no indication of what happened.

Best-practice decisions:

- **Do not introduce a 403 response on the API side.** Follow the convention used by OWASP, the GitHub API, and many production systems: never disclose whether a resource belongs to someone else; always return 404. Item IDs are UUIDs and are practically unguessable. The current backend implementation already aligns with this principle.
- **Add a dedicated 404 page on the frontend and navigate to it via `router.replace`.** This keeps the SPA navigation flow consistent and aligns the URL with the page being displayed (an accessibility win).
- 401 behavior (redirect to home) is already correct, so leave it unchanged.

Confirmed scope:

- API: **keep returning 404 only** (no backend code changes)
- Frontend: **a single 404 page only** (403 / generic error pages may be added later)
- Router catch-all: route to the 404 page
- Only navigation control on the 404 page is a **"BACK TO HOME" link**

## Implementation Plan

### 1. Create a new design mockup at `docs/html/error-not-found.html`

Strictly follow the existing design conventions used in pages such as `item-list.html`. Do not introduce new colors, fonts, or design tokens.

- Copy the file skeleton verbatim from `docs/html/item-list.html:1-56,196-201`, including the Tailwind CDN configuration (primary/secondary color tokens, `DM Mono` / `Inter` fonts, `bg-stone-50 min-h-screen flex flex-col`).
- Copy the global header (`item-list.html:58-76`) and footer (`item-list.html:196-198`) exactly.
- Page header: `<h1 class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2">Not Found</h1>` (reuse the existing page-header classes verbatim).
- Body: a single paragraph of message text plus one "BACK TO HOME" button.
  - Message: a short English sentence such as "The page you're looking for doesn't exist or has been removed."
  - Button: reuse the same classes as the Add button in `item-list.html:89-97` (`inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2`). Use a simple home icon (e.g. `<path d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10"/>`) sized `w-4 h-4`. Label: `Back to home` styled `font-logo text-xs tracking-widest uppercase`.
- Layout matches existing pages: `max-w-sm mx-auto`, with the main region using `flex-1 px-4 py-8`.

### 2. Create a new Vue page component at `apps/frontend/src/views/NotFoundView.vue`

- Build the `<template>` from the main section of `docs/html/error-not-found.html` (excluding header/footer). The header/footer are rendered by `App.vue:10-12`, so they must not be re-rendered inside this component.
- Implement "BACK TO HOME" as `<RouterLink :to="{ name: 'home' }">`.
- `<script setup lang="ts">` should contain only imports — no state. This is a pure placeholder page.
- Auth: this page is visible to unauthenticated users as well (so users who hit the URL via a typo can see it).

### 3. Update the router (`apps/frontend/src/router/index.ts`)

Changes:

- Around line 9, add `const NotFoundView = () => import("../views/NotFoundView.vue");` (following the existing lazy-import pattern).
- Replace the existing `{ path: "/:pathMatch(.*)*", redirect: { name: "home" } }` at line 44 with:

  ```ts
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundView,
    meta: { requiresAuth: false, showAppHeader: true },
  },
  ```

  - `requiresAuth: false` — visible regardless of auth state.
  - `showAppHeader: true` — consistent with existing post-auth pages (matches the header-rendering condition at `App.vue:10`). The avatar block in `AppHeader.vue` already toggles between a person/generic icon based on `useAuth().user?.picture` (`AppHeader.vue:21-37`), so the layout does not break for unauthenticated visitors.
- `router.beforeEach` (lines 48-70) does not need to change: the early-return for `requiresAuth: false` at line 49 lets this route through.

### 4. Update the item detail page (`apps/frontend/src/views/ItemDetailView.vue`)

Current behavior (summary):

- Inside `onMounted` (lines 64-89), a 404 response is converted to `notFound.value = true`, and the inline message is rendered in the template at lines 110-116.

Changes:

- Replace `if (e instanceof ApiError && e.status === 404) { notFound.value = true; return; }` at lines 80-83 with `void router.replace({ name: "not-found" }); return;`.
- Apply the same change to the missing-route-parameter case at lines 64-69 (`if (!itemId) { notFound.value = true; ... }`): redirect to `not-found` via `router.replace`.
- Remove the `notFound` `ref` declaration and the `<div v-else-if="notFound">…</div>` block in the template at lines 110-116.
- Keep the 401 → `router.replace({ name: "home" })` handling at lines 76-78 unchanged.

### 5. Update the item edit page (`apps/frontend/src/views/ItemEditView.vue`)

Apply the same shape of change as `ItemDetailView` to `onMounted` (lines 44-84) and to the UPDATE/DELETE handlers (lines 136-139, 164-166):

- Replace the 404 → `notFound.value = true` at lines 75-78 with `router.replace({ name: "not-found" })`.
- Change the early return for `if (!rawId)` at lines 44-49 to `router.replace({ name: "not-found" })`.
- For the case where 404 is returned during UPDATE / DELETE (e.g. the item was deleted in another tab), also navigate to the `not-found` page. Add this as a sibling branch to the existing 401 → home redirect.
- Remove the `notFound` ref and the corresponding template block at lines 193-199.

### 6. Update `docs/state.md`

- Move the `Error page design exploration` entry under "In Progress" into "Completed", and replace it with concrete completed items:
  - `Error page (404) design`
    - `Create an HTML design mockup under docs/html`
    - `Keep the shared global header and footer, color palette, font sizes, and icon sizes consistent with other pages`
  - `Error page (404) implementation`
    - `Add NotFoundView and a catch-all route`
    - `Replace the inline "Item not found." fallback in detail/edit pages with a redirect to the 404 page`
    - `For ownership/forbidden cases, intentionally rely on the API's 404 behavior (no 403 to avoid leaking resource existence)`

### Explicitly out of scope

- Backend (`apps/backend`): **no code changes**. 404 is already returned appropriately, and we have decided not to add 403.
- CDK (`infra/cdk`): no changes either. CloudFront `customErrorResponses` works fine via the SPA fallback function; no extra configuration is needed for the new error page.
- A generic error page (5xx, network errors) is left as future work. This change covers 404 only.

## Key Files

| Type | Path |
|---|---|
| New (design) | `docs/html/error-not-found.html` |
| New (implementation) | `apps/frontend/src/views/NotFoundView.vue` |
| Modified | `apps/frontend/src/router/index.ts` |
| Modified | `apps/frontend/src/views/ItemDetailView.vue` |
| Modified | `apps/frontend/src/views/ItemEditView.vue` |
| Modified | `docs/state.md` |
| Reference (no change) | `apps/frontend/src/components/AppHeader.vue` (existing header reused as-is) |
| Reference (no change) | `apps/frontend/src/lib/api.ts` (`ApiError` class used as-is) |
| Reference (no change) | `apps/backend/src/app.ts` (already returns 404) |

## Verification

After starting the local dev server (`pnpm --filter frontend dev`), perform the following checks in Chrome.

1. **Undefined URL → 404**
   - Visit a non-existent path such as `/abc/xyz` and confirm the 404 page is shown.
   - The header/footer should render with the same look as other post-auth pages.
2. **Non-existent item ID → redirect to 404 page**
   - Visit `/items/00000000-0000-0000-0000-000000000000`. The API returns 404; the frontend should not display an inline message under the original URL but `router.replace` to the catch-all 404 view.
3. **Edit page 404 → 404 page**
   - Visit `/items/00000000-0000-0000-0000-000000000000/edit` and confirm the same redirect.
4. **Item deleted while editing → 404 page**
   - Delete an item in another tab, then press Apply / Delete in the original edit tab; the page should navigate to the 404 page.
5. **"BACK TO HOME" works**
   - Click the button on the 404 page and confirm it returns to home, both when authenticated and when unauthenticated.
6. **No regressions in existing behavior**
   - `/items` list, `/items/:id` detail (real ID), and `/items/:id/edit` (real ID) still open as before.
   - 401 → home redirect still works (e.g. opening item detail right after logging out).

E2E tests (`tests/e2e`) are not yet in their build-out phase, so this round relies on manual verification only.

# 2026-07-22 — Resources integration (real Omega catalog, id-keyed documents)

Slice 2 of the Alpha↔Omega parity work: the Overview resource system stops being a
client-only `localStorage` mock and becomes a real client over Taurus Omega's canonical
**Resource catalog**. This closes the last mock on the Overview stage (purpose and
activity landed the day before).

## What changed and why

### `src/lib/data/resources.ts` — API-backed store

Rewrote the module from a seeded `localStorage` mock into a thin client:

- `resources` is loaded from `GET /resources` (cursor-paged, walked to completion).
- New `availableKinds` writable + `canCreate(kind)` mirror the catalog's `availableKinds`
  — the subset of the closed kind vocabulary Omega can create **today**, which is just
  `document`.
- `addResource` → `POST /resources`; `removeResource` / `renameResource` →
  `DELETE` / `PATCH /resources/:kind/:id` (the kind is resolved from the loaded catalog,
  so callers keep passing ids). All async; `enterProjectResources` carries a
  409→`openProject`→retry fallback and never throws.
- The seed data and `localStorage` load/persist helpers are gone; `relativeTime` and
  `RESOURCE_KINDS` stay.

### `stages/document/runtime.ts` — id-keyed tab↔document binding

A `document` resource's id **is** its real Omega document id. `DocumentRuntime` gained a
`resourceId` field (new constructor arg); `load()` now loads the canonical document
directly by id when the tab carries one (with the same 409 retry). The old
list-by-name/create-if-missing path is kept only as a fallback for **legacy tabs**
persisted before ids existed. This removes the v1 name-keyed binding for all new tabs.

### Create surfaces gated on `availableKinds`

Because Omega creates only documents today, every create path gates rather than firing a
request that would 409:

- `overview/OverviewStage.svelte` and `new-tab/NewTabStage.svelte`: `create` (and, in the
  launcher, templates + AI-create) are async, check `canCreate`, `await addResource`, and
  open/resolve the tab carrying the resource's kind. Table `onremove`/`onrename` are now
  async-safe (`void … .catch(toast)`); `onimport` toasts "Importing files isn't available
  yet."
- `overview/CreateColumn.svelte` and `new-tab/NewResourcePanel.svelte`: non-available
  kinds render **disabled** with a "Soon" hint / "Coming soon" title.
- `stages/shared/ResourceTable.svelte`: the import "+" button (which created a `general`
  resource) is hidden until `general` is creatable.
- `shell/panels/ResourcesPanel.svelte`: dropped the **Mock** badge (the list is real now)
  and passes the kind into `openTab`.

## Scope / honest boundaries

- **Documents-only.** Spreadsheet / slides / chat / general are recognized kinds but not
  yet creatable; they stay gated until Omega adds their family adapters, at which point
  they join `availableKinds` and the surfaces enable with no further front-end change.
- **File import** and **content download/export** remain placeholders — tracked as
  follow-ups in [backend-requests/resources.md](../backend-requests/resources.md).

## Docs

- [discrepancies/resources.md](../../discrepancies/resources.md) rewritten (real catalog +
  gating + placeholders); [discrepancies/documents.md](../../discrepancies/documents.md)
  updated (binding is now id-keyed); [discrepancies/overview.md](../../discrepancies/overview.md)
  notes the table is real too.
- [backend-requests/resources.md](../backend-requests/resources.md) marked **Shipped**
  (documents) with the remaining follow-ups; both index READMEs updated.
- Every changed source file's `.md` companion regenerated to stay byte-verbatim.

## Verification

`pnpm check` 0/0 and `pnpm build` green. All companions pass the verbatim oracle. Browser
E2E: create a Document from Overview → it opens in the real editor, persists, and appears
in the table; rename and delete round-trip through Omega; non-document create tiles show
disabled.

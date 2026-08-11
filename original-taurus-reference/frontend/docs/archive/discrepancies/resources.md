# Discrepancy — project resources are real (documents), with gated kinds

Resources (the documents / spreadsheets / slides / chats / general files a project
contains) are the core content of the Overview stage. They are now backed by Taurus
Omega's canonical **Resource catalog** — no more `localStorage` mock. What remains here
is one honest boundary: Omega currently creates only **documents**, so every other kind
is either gated off or (for slides) created locally against a front-end mock.

## How the front-end copes today

`src/lib/data/resources.ts` is a thin client over the selected-project resource catalog.
The `resources` store is loaded from `GET /resources` (cursor-paged, walked to
completion); `addResource` / `removeResource` / `renameResource` call
`POST /resources` and `DELETE` / `PATCH /resources/:kind/:id`. The shape the UI uses:

```ts
type ResourceKind = 'document' | 'spreadsheet' | 'slides' | 'chat' | 'general';
type Resource = { id: string; name: string; kind: ResourceKind; updatedAt: number };
```

A resource's `id` is its canonical family id — for a `document` it **is** the real Omega
document id, so opening one binds the tab to its document by id (see the id-keyed binding
note in [documents.md](documents.md)), not by name.

### Available kinds — what Omega creates, plus one local mock

Omega exposes the full kind *vocabulary* above but reports which kinds are actually
**creatable** via `availableKinds` on the catalog response — today just `["document"]`.
`systems/resources/api.ts` then injects **`slides`** as a locally-available kind and
`addResource` creates non-document kinds locally, so the slides stage has something to
open; that injection is the one place this list is not Omega's answer. The store mirrors
the result in an `availableKinds` writable, and every create surface gates on it:

- The Overview **Create** column and the New-tab **New resource** row render
  non-available kinds **disabled** with a "Soon" hint (`CreateColumn.svelte`,
  `NewResourcePanel.svelte`).
- Templates and AI-create only fire for available kinds; otherwise they toast
  "…aren't available yet" rather than sending a request that would 409.

When Omega grows an adapter for a kind (spreadsheet, slides, chat), it appears in
`availableKinds` and those surfaces light up with no front-end change.

### Import and export are real

Both are shipped for documents and no longer placeholders. `systems/documents/io.ts`
imports Markdown through `POST /files` + `POST /documents/import`, and exports real
content via `GET /documents/:id/export`. Neither lives in the generic resources panel:
transfer is a **per-kind** table in
[`features/shared/transfer.ts`](../../src/lib/features/shared/transfer.ts) (`importers`
and `exporterFor`), so the panel itself names no kind and a kind without a transfer spec
simply offers nothing. Only Markdown round-trips; pdf/docx is
[deliberately deferred](../deferred/pdf-docx-import-export.md).

## Feature gap → backend request

The core list / create / rename / delete is **shipped** (see
[backend-requests/resources.md](../archive/backend-requests/resources.md)), as is
document import/export. The remaining ask is non-document **kind adapters**: when Omega
grows one, `availableKinds` carries it and the create surfaces enable with no front-end
change. The matching front-end work — actual stages for the other kinds — is
[on our roadmap](../roadmap.md), not a backend request.

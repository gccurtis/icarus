# src/lib/data/documents.ts — breakdown

Companion to [documents.ts](documents.ts). **The** facade for the documents system — under the
import convention settled in workstream D (AGENTS.md → *Import convention*), `$data/documents`
is the one `$data` name for this system; precise needs import `$systems/documents/<submodule>`
directly, and no other facades exist (`document-inspector`/`document-layout`/
`document-collaboration` were deleted for re-exporting this same barrel under extra names).
The document content types (atoms, marks, blocks, rows, docs), the change-op/change-set shapes,
and the Omega API client (CRUD, `appendChanges`, prompt resolution, job polling) that this file
once held now live across `src/lib/systems/documents/` — chiefly `types.ts` and `api.ts`.

## Re-export

### Forward everything from the documents systems barrel

```ts
export * from '$systems/documents/index';
```

`$systems/documents/index` is the single documents surface, re-exporting the shape
types, HTTP client, layout and inspector helpers, collaboration, context, AI tasks,
styles, Markdown IO, comments, and references. Re-exporting it here keeps existing
`$data/documents` importers resolving unchanged while the implementation lives under
`src/lib/systems/documents/`.

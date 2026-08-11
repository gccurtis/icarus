# Backend request — project resources

**Priority:** High · **Status:** **Partially shipped** — the document catalog and
lifecycle are live; additional kind adapters, import, and content export remain open.
**Unblocks:** the Overview resource table (list / sort / filter / search), the create
cards, and per-resource open — now backed by Omega's real resource catalog (see
[discrepancies/resources.md](../discrepancies/resources.md)).

## What shipped

Omega's **Resource catalog** is a selected-project-scoped, cross-family lifecycle. The
cockpit's `src/lib/data/resources.ts` now uses it for real:

```http
GET    /resources?limit=&cursor=
  -> 200 { "resources": [ { "id", "kind", "name", "createdAt", "updatedAt" } ],
           "availableKinds": ["document"], "nextCursor": null }

POST   /resources                 { "kind", "name" }   # create (read role -> 403)
  -> 201 { ...resource }              # 409 if kind unavailable, 400 if kind unknown

GET    /resources/:kind/:id       # current metadata point-read
PATCH  /resources/:kind/:id       { "name" }           # rename
DELETE /resources/:kind/:id                            # delete
```

- `createdAt` / `updatedAt` are RFC3339 strings; the UI parses them to epoch ms and
  sorts on `updatedAt`.
- `kind` is the closed vocabulary `document | spreadsheet | slides | chat | general`;
  **`availableKinds`** reports the subset that can be created today. Only `document` is
  available now — the others are recognized but return `409` on create, so the front-end
  gates its create surfaces on `availableKinds`.
- Resource identity is `(kind, family-owned id)`. A `document` resource's `id` **is** the
  real Omega document id, so a document tab carries it and the editor loads by id — the
  canonical name-keyed tab↔document binding is gone. A name-based path remains only for
  legacy persisted tabs that predate resource ids (see
  [discrepancies/documents.md](../discrepancies/documents.md)).
- Create / rename / delete respect the caller's project role (owner/edit mutate; read
  cannot), mirroring `/projects`.

## Remaining follow-ups

- **Kind adapters** — spreadsheet / slides / chat / general are in the vocabulary but not
  yet creatable. Each needs a family owner-adapter in Omega; when one lands it joins
  `availableKinds` and the cockpit's create surfaces enable it automatically.
- **File import** — a `general` "uploaded file" path (multipart or presigned) so the
  table's import affordance can return. Blocked on the `general` adapter.
- **Content download / export** — the row/bulk download currently serializes a
  placeholder stub; a real export of a resource's content is a separate ask once the
  per-kind content endpoints exist.

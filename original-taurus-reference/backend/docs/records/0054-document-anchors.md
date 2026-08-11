# Document Anchors for External References (R19)

Adds stable structural pointers into documents that external systems
(comments, notes, citations) can use to reference specific content. The
document owns the anchor contract; thread content stays elsewhere.

## What changed

- **DocumentAnchor** — new type: `{id, documentId, rowId, blockId, atomId,
  start, end, state, createdAt}`. State is `"valid"` or `"orphaned"`.

- **SQLite** — `document_anchors` table with CRUD store methods.

- **Service** — `CreateAnchor` (validates target exists), `ListAnchors`,
  `DeleteAnchor`, `ValidateAnchor` (checks target against resolved head,
  updates state), `RebaseAnchors` (called after each ChangeSet commit —
  marks deleted targets orphaned, updates row IDs for moved blocks).

- **Anchor rebase** — integrated into `SubmitChanges`. After a ChangeSet
  is committed, walks all anchors on the document and applies operation-
  specific rules: `OpDeleteRow/Block/Atom` → `orphaned`, `OpMoveBlock`
  → update `rowId` to new parent row.

- **Handler** — four endpoints:
  - `POST /documents/:id/anchors` — create (write access)
  - `GET /documents/:id/anchors` — list (read access)
  - `DELETE /documents/:id/anchors/:anchorID` — delete (write access)
  - `POST /documents/:id/anchors/:anchorID/validate` — validate (read access)

- **Tests** — 7 service tests (create, list, invalid target, orphan after
  delete, row rebase after move, delete anchor, validate + resolve).
  1 transport test (full HTTP round-trip).

## Why

R19 from the document backend checklist. External systems that need to
reference document content (a future comment/thread system, citations,
cross-reference links) can create stable anchors that survive structural
moves and explicitly orphan when targets are deleted. Thread content,
replies, and resolution state are not stored here — only the pointer
contract.

# Document Duplicate (R15)

Duplicates a document with fresh internal IDs and remapped cross-references.

## What changed

- **duplicate.go** — `duplicateBase` deep-copies a Base while regenerating
  every internal ID (rows, blocks, atoms, marks, style definitions,
  style defaults) and remapping all references (block StyleRef.StyleID,
  mark Start/End anchors to new atom IDs, style registry keys).

- **Service** — `Duplicate(projectID, sourceID, actor)` fetches the
  source, generates a unique name with a numbered suffix ("Name (1)",
  "Name (2)", ...), calls `duplicateBase`, creates the new document
  with `Lifecycle: active`, and records an activity fact with
  `sourceKind: "document.duplicate"` and `sourceID: <original-doc-id>`.

- **Name dedup** — `duplicateName` queries all active document names in
  the project and increments the suffix until a free name is found.

- **Handler** — `POST /documents/:id/duplicate` (sync, write access).
  Returns 201 with the new Document. Cross-project returns 404.

- **Activity** — added `ActivityDuplicated = "duplicated"` constant and
  added to the SQLite activity whitelist.

- **Tests** — 7 service-level tests (fresh IDs, style remapping, mark
  anchor remapping, name dedup, activity fact, formula preservation,
  header/footer preservation). 1 transport test (create, duplicate,
  second duplicate name increment, cross-project 404).

## Why

R15 from the document backend checklist. Duplicate is the second
document lifecycle operation after archive/restore (R14). It provides
the deep-copy engine that templates (R16) will reuse for instantiation.

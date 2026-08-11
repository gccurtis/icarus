# Document History Comparison (R18)

Adds a structural diff engine that compares two document revision heads at
Row / Block / Atom / Mark granularity using stable IDs.

## What changed

- **diff.go** — new comparison engine: `diffBases(old, new, bounds)` builds
  index maps by stable ID, walks both trees in parallel, and reports
  added, removed, moved, and content-changed items. Text excerpts for
  content-changed atoms are capped to a configurable length.

- **DiffChange** — one structural difference: kind (`added`, `removed`,
  `moved`, `content-changed`), level (`row`, `block`, `atom`, `mark`),
  entity ID, parent ID, old/new positions, old/new kind, old/new text
  excerpts.

- **DiffBounds** — limits how many changes and how long text excerpts are.

- **DiffResult** — the outcome: old/new revision, list of changes,
  truncated flag.

- **GetAtRevision** — resolves a document's base only up to a given
  revision sequence (filters pending change sets to those with
  Seq ≤ target).

- **Diff** — compares two revisions via `GetAtRevision` then delegates
  to `diffBases`.

- **Handler** — `GET /documents/:id/diff?old=N&new=M&limit=50` (sync,
  any role). Required `old` query param must be less than `new`.

- **Transport** — route + operationSync entry.

## Why

R18 from the document backend checklist. Provides a structural diff
that clients can use to show what changed between any two document
revisions. The diff operates at the data model level (rows, blocks,
atoms, marks) using stable IDs, not raw text. Bounded to prevent
unbounded work on large documents.

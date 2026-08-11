# service_crud.go

The CRUD surface of the `Documents` service: creating a document, renaming it,
duplicating it, the metadata-only listings, and `Get`.

Two rules run through the whole file. **Project scoping is enforced twice.**
Every load now passes the caller's `projectID` into `store.DocumentByID`, which
filters on it, so a foreign document never leaves the store; and each method
*still* compares `doc.ProjectID` to `projectID` and reports `ErrNotFound` on a
mismatch — never a distinct "forbidden" error, so a project cannot even confirm
the existence of another project's documents. The second check is **deliberately
redundant** with the first (DEF-1) and is not to be removed as "now
unnecessary": the SQL predicate covers a caller who forgets to compare, the
comparison covers a store that does not scope, and neither is load-bearing
alone. And **only
`Get` folds pending change sets**: every listing returns stored metadata
untouched, because a body assembled from a stale base would be wrong and
assembling one per row would be expensive.

## Code breakdown

### Create: name, geometry, ids, validation, fact

`Create` trims the name and rejects a blank one with `ErrInvalidName`, then
fills in what the caller left out — the service's default `PageLayout` if the
base carries none, and always the service's `LayoutRules` (row metrics are a
service-level decision, not a per-document one). `assignIDs` and
`normalizeStoredStyleState` run before `validateContent`, so validation sees the
content exactly as it will be stored.

The document is created with `Lifecycle: LifecycleActive` and identical
`CreatedAt`/`UpdatedAt` taken from the service clock. The `ActivityCreated`
fact is passed into `store.CreateDocument` alongside the document, so the fact
and the row commit together. Only after the store succeeds does it call
`d.reindexReferences(...)` — link extraction is a follow-on effect of a
persisted document, never a precondition.

### Rename: normalized no-op, then a fact

`Rename` trims and rejects a blank name, loads and project-scopes the document,
and normalizes the stored base on the way out (so a rename response carries the
same normalized shape a `Get` would). The distinguishing behaviour:

```go
if doc.Name == name {
	return doc, nil
}
```

An identical name after trimming is a no-op — the `UpdatedAt` timestamp is left
alone and **no Activity fact is emitted**, so a client that re-sends the current
name cannot manufacture history. A real rename emits `ActivityRenamed` with
`fact.TargetName` set to the *new* name (the fact's `TargetName` normally comes
from the document, which still holds the old one).

### List: identity and metadata, never bodies

`List` projects every active document in the project to a `Summary` — id, name,
creator, timestamps. The doc comment states the reason bodies are absent: a
body needs pending change sets folded in, which only `Get` does, so a listing
carrying bodies would show stale content.

### RevisionHints: the cheap staleness probe

A `map[documentID]revision` over the project, for clients holding several open
documents that want to know which ones moved without fetching any of them.

### Summaries and Summary: bounded metadata

`Summaries` delegates straight to `store.DocumentSummaries` with the caller's
`SummaryBoundary` and limit — the pagination policy lives in the store.
`Summary` is the single-document equivalent: load, project-scope, project to
`Summary`. Neither resolves content or replays change sets.

### Get: the one resolved read

`Get` is the read every caller that needs *content* uses. It loads the
document, project-scopes it, normalizes the stored base and style state, then
applies every change set after `doc.BaseSeq`:

```go
pending, err := d.store.ChangeSetsSince(id, doc.BaseSeq)
...
resolved, err := applyChangeSets(doc.Base, pending)
```

The result is the current content even when re-base has not yet folded the
pending sets in. Note that `doc.Revision` is left as stored — it is already the
head sequence — while `service_history.go`'s `GetAtRevision` has to recompute
it because it truncates the pending list.

### Duplicate: a copy that shares no identifiers

`Duplicate` loads and project-scopes the source, picks a free name, and builds
a new `Document` around `duplicateBase(src.Base)` (`duplicate.go`), which
regenerates every internal id — rows, blocks, atoms, marks, styles — and remaps
every cross-reference between them. The copy is a fresh document, not a
revision of the source: it starts at `LifecycleActive` with new timestamps and
the calling actor as creator. Its `ActivityDuplicated` fact carries the
*source* id as `sourceID`, which is what links the two in an activity feed.

Only the base is copied. Change-set history, submissions, and anchors stay with
the source.

### duplicateName: first free numbered suffix

`duplicateName` loads the project's documents into a taken-set and counts up
through `"Name (1)"`, `"Name (2)"`, … until one is free. The loop has no bound
because the taken set is finite, so some `n` must be free. Name collisions are
avoided by construction rather than reported as an error.

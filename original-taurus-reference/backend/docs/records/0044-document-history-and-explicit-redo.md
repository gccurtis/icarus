# 0044 Document History and explicit redo

This increment completes roadmap R2. Documents now expose bounded, inspectable
revision History and an explicit redo command while preserving the existing
append-only compensation model. Detailed operation/inverse retention is
separated from content-free History summaries so reconstruction and the current
undo/redo recipe remain available without making the public timeline
unbounded.

## `core/capability/document/history.go`

### Define the bounded History projection

`HistoryEntry` snapshots trusted author identity, revision lineage, bounded
operation metadata, detail availability, and viewer-specific eligibility.
Affected row, block, atom, and mark IDs are deduplicated and capped, oversized
IDs are omitted, and truncation is explicit. The summary deliberately excludes
arbitrary content and inverse recipes.

### Add document-bound keyset traversal

`Documents.History` returns newest-first pages with a default of 20 and maximum
of 100. Strict opaque cursors carry only a version, Document ID, and exclusive
revision boundary, preventing accidental cross-document reuse while remaining
an ordering bookmark rather than authority. `Documents.ChangeSet` separately
returns retained public detail after Project reauthorization.

## `core/capability/document/history.go.md`

### Document the History implementation verbatim

The new companion reproduces the History source exactly and explains bounds,
cursor validation, service queries, cloning, and summary construction in source
order.

## `core/capability/document/changeset.go`

### Attach attribution, redo lineage, and summaries

`ChangeSet` now retains the trusted author-name snapshot, `RedoOf`, and its
server-computed `ChangeSummary`. Cloning includes summary slices so store reads
cannot mutate retained metadata.

## `core/capability/document/changeset.go.md`

### Keep ChangeSet documentation aligned

The companion now reflects the added metadata and summary cloning verbatim.

## `core/capability/document/document.go`

### Make redo an explicit compensation

`Documents.Redo` accepts only the requesting author's current-head undo
revision, then appends its stored inverse with `RedoOf` lineage. `Undo` rejects
undo revisions so clients cannot bypass the explicit redo contract; redo
revisions remain undoable. Head advancement naturally invalidates a stale redo
candidate.

### Separate History summaries from compensation detail

The Store port gains newest-first summary traversal. Accepted revisions snapshot
trusted author name and summary metadata. Positive History retention now pins
pending reconstruction detail and the current-head compensation recipe while
allowing older detailed rows to be removed.

## `core/capability/document/document.go.md`

### Describe the current service contract verbatim

The companion includes the new errors, Store method, option semantics, redo
path, metadata assignment, and retention behavior.

## `core/capability/document/memory.go`

### Mirror immutable History and tiered pruning in memory

The reference store commits a cloned summary with every ChangeSet, keyset-pages
it newest-first, derives detail/inverse availability at read time, and prunes
old folded detail separately from the newest configured summary entries.

## `core/capability/document/memory.go.md`

### Keep the reference-store companion current

The companion reproduces the History map, append path, query, delete behavior,
and pruning contract exactly.

## `core/handlers/document/document.go`

### Expose History list/get and explicit redo

The History handler parses and validates `limit`/`cursor`, returns
`{entries,nextCursor}`, and distinguishes an absent Document from pruned
ChangeSet detail. Redo uses the same write-role and author/head safety boundary
as undo, with explicit conflict messages.

## `core/handlers/document/document.go.md`

### Document the HTTP adapters verbatim

The companion now covers History query parsing, detail lookup, undo
ineligibility, and redo response mapping.

## `core/platform/config/config.go`

### Clarify the History retention setting

The configuration comment now states that a positive limit bounds summaries
while retaining reconstruction and current-head undo/redo detail.

## `core/platform/config/config.go.md`

### Keep configuration documentation exact

The companion reproduces the clarified option contract.

## `core/platform/storage/sqlite/sqlite.go`

### Persist immutable summaries and explicit lineage

`change_sets` gains trusted author name, `redo_of`, and summary JSON.
`document_history` stores independently prunable content-free metadata with a
descending Document/revision index. Append commits detail, History, receipt,
Document revision, and Activity in one transaction; partial unique indexes
prevent duplicate direct undo or redo compensation.

### Migrate legacy revisions without resurrecting pruned History

Additive migration derives summaries only for legacy detail rows still carrying
an empty summary or missing their matching History entry. Migrated startups no
longer decode every retained operation blob, and detail already removed by
retention cannot repopulate pruned History.

### Prune retention tiers atomically

Pruning removes folded detailed rows below the current head, retains pending
reconstruction rows and the head inverse, then bounds `document_history` to the
newest configured entries in the same transaction.

## `core/platform/storage/sqlite/sqlite.go.md`

### Keep SQLite's companion synchronized

The companion reproduces the schema, migration, append, History query,
scanning, deletion, and tiered-pruning changes verbatim.

## `core/transport/transport.go`

### Register the R2 operation surface

`documents.history.list`, `documents.history.get`, and `documents.redo` are
explicit synchronous operations with production project-scoped routes.

## `core/transport/transport.go.md`

### Document dispatch and routes verbatim

The transport companion now includes the three R2 operation classifications and
route registrations.

## Tests

### Prove History bounds, retention, and eligibility

Document tests cover pagination, content-free summaries, affected IDs, retained
detail, viewer-specific eligibility, explicit redo lineage, invalidation by a
new edit, repeated undo/redo cycles, and concurrent redo acceptance.

SQLite tests round-trip all new metadata, exercise History paging and tiered
retention, and verify migration does not expand previously pruned History.
Transport tests cover list/get validation and errors plus the explicit redo
route and resulting revisions.

## `dev-test/changesets/run.sh`

### Exercise the public R2 workflow

The executable walkthrough lists and pages History, fetches retained detail,
checks ineligible redo, then performs undo and explicit redo through the running
server.

## `dev-test/changesets/manual.md`

### Explain the R2 request sequence

The manual documents History response fields, cursor usage, detail retrieval,
explicit redo, and the current-head invalidation rule.

## Current architecture and support documentation

### Advance the implemented contract to R2

The Document capability, persistence, configuration, transport, backend guide,
and orientation now describe public History, explicit compensation lineage,
cursor bounds, eligibility, and the split between summary and detailed
retention. The alignment assessment marks gap 2 closed, the roadmap and
checklist mark R2 complete, and the next focus advances to R3.

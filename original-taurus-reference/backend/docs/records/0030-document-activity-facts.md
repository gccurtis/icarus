# 0030 Atomic Document activity facts

This increment makes canonical Document mutations the source of Activity truth
and corrects visible timestamp semantics.

## `core/capability/document/document.go`

### Add trusted actors, closed facts, rename, and bounded summaries

Document create/edit/rename/delete now build safe facts containing only actor
and target snapshots plus stable source identity. Rename is Project-scoped and
no-op aware. Change sets carry display-name snapshots and owner summary paging
supports the Resource adapter.

## `core/capability/document/memory.go`

### Commit facts with in-memory canonical effects

The test store records one fact under the same lock as each effect, updates
visible time on append, retains deletion snapshots, implements rename/summary
paging, and leaves rebase time unchanged.

## `core/capability/document/document_test.go`

### Verify the complete semantic lifecycle

Tests created/renamed/edited/deleted facts, actor and target snapshots, rename
no-ops, append timestamps, and rebase timestamp stability.

## `core/handlers/document/document.go`

### Supply trusted request actors and direct rename

Handlers snapshot the authenticated display name (email fallback), pass it to
every direct Document mutation, and expose `PATCH /documents/:documentID`.

## `core/platform/storage/sqlite/sqlite.go`

### Make canonical effects and Activity atomic

Create, append, rename, and delete now run explicit transactions that include
their event insertion. Append advances Document visible time; rebase only folds
base state. Startup repairs historical Document timestamps from retained change
sets, normalizes sortable values, and raises historical Project profile time
without inventing events.

## `core/platform/storage/sqlite/sqlite_test.go`

### Prove rollback, snapshots, sequencing, and timestamp storage

Direct store tests supply closed facts, confirm a duplicate event source rolls
back its Document create, and read created/deleted snapshots after content is
gone while retaining concurrent sequence coverage.

## `core/transport/transport.go`

### Classify direct rename as synchronous

Adds the Document rename operation and route alongside existing synchronous
Document mutations.

## Document and Activity architecture docs

### Record owner-transaction invariants

Current-state docs explain exactly which effects emit, why rebase does not, and
why Activity is neither arbitrary logging nor canonical content history.

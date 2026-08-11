# 0031 Unified Resource lifecycle

This increment provides one catalog and lifecycle surface without duplicating
family-owned identity or metadata.

## `core/capability/resource/resource.go`

### Define the fixed owner-routed catalog

Adds the known kind vocabulary, family port, tagged summaries, availability and
validation errors, lifecycle dispatch, and global keyset order
`updatedAt DESC, kind ASC, id ASC` with bounded live pages.

## `core/capability/resource/resource_test.go`

### Test cross-family merge and honest availability

Exercises equal-time kind ordering, multi-page traversal, unknown/unavailable
kinds, blank names, and duplicate family rejection.

## `core/wiring/resource_document.go`

### Adapt canonical Documents without importing them into Resource

Maps bounded owner summaries, trusted actors, lifecycle operations, and stable
errors between the two capabilities. Resource never writes Activity; Documents
continues to do so exactly once.

## `core/handlers/resource/resource.go`

### Expose Project-scoped list/create/rename/delete

Adds HTTP mapping, owner/edit authorization, page parsing, canonical summary
views, nullable cursors, and explicit 400/404/409 distinctions.

## `core/transport/transport.go` and `core/wiring/wiring.go`

### Register the available Document family and routes

Production composition freezes the Resource service with one Document adapter;
transport installs four synchronous Project-scoped operations.

## `core/capability/document/*` and SQLite

### Add bounded owner summary queries

Memory and SQLite stores project Document metadata with an exclusive common
boundary instead of loading unbounded content into the catalog.

## Transport tests and dev-test Resources suite

### Verify canonical identity and lifecycle end to end

Tests prove Resource IDs fetch the same Documents, rename/delete affect the
canonical owner, unsupported kinds create nothing, Activity retains deletion,
and the full path survives SQLite restart. The manual and automated suite expose
the same workflow for a running backend.

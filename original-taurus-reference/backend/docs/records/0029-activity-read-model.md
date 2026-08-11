# 0029 Project Activity read model

This increment establishes the safe, bounded read side before connecting the
only production writers in the following Document increment.

## `core/capability/activity/activity.go`

### Define immutable semantic events and strict keyset paging

Introduces the closed action vocabulary, actor/target snapshots, Store read
port, latest-by-Project query, default/max limits, and versioned opaque cursor
ordered by occurrence time then ID.

## `core/capability/activity/memory.go`

### Provide deterministic isolated reads

Adds a concurrency-safe store seeded at construction time. It supports paging
and batched latest reads but deliberately exposes no production append method.

## `core/capability/activity/activity_test.go`

### Prove ordering, cursor, isolation, and bounds

Tests equal-time ID ordering, multi-page traversal, malformed input, and latest
selection without leaking unrequested Projects.

## `core/endpoint/endpoint.go`

### Add a neutral query-parameter capability

Extends transport-neutral requests with `Query`, allowing paginated handlers to
remain independent of Echo.

## `core/handlers/activity/activity.go`

### Expose the selected Project feed

Adds `GET /activity`, strict limit parsing, cursor/error mapping, safe event JSON,
and nullable next cursors.

## `core/platform/storage/sqlite/sqlite.go`

### Persist and query semantic snapshots

Adds `activity_events`, its Project/time index and unique owner-source identity,
plus keyset and batched-latest reads.

## `core/transport/transport.go` and `core/wiring/wiring.go`

### Wire the Project-scoped read service

Composition builds Activity over the shared durable store and registers the
route only when supplied.

## SQLite and transport tests

### Exercise durable paging and route gates

Tests tie ordering, Project filtering, latest reads, anonymous/project gates,
empty responses, malformed cursors, and limit bounds.

# sqlite.go

The core of the SQLite-backed store: opening the database, the connection
settings that make concurrent reads safe alongside SQLite's single writer, the
timestamp encodings every table shares, and the compile-time assertions that
prove one `*Store` really does implement every persistence port in the
application.

This file holds only what the whole package shares. The persistence methods
themselves live in sibling `sqlite_<capability>.go` files — access, document,
knowledge, chat, agent, and so on — one per capability boundary in
`core/capability`. That split is organizational: every file in the package hangs
its methods off the same `*Store` and uses the same `*sql.DB`, so there is still
exactly one connection pool and one database file behind all of them.

## Code breakdown

### Package doc: one store, one file, no cgo

The package comment records the two decisions that shape everything else. The
driver is `modernc.org/sqlite`, a pure-Go implementation, so the binary builds
with plain `go build` and needs no C toolchain. And a single `Store` value
implements *every* persistence interface rather than one type per domain, so one
file backs users, sessions, projects, documents, knowledge, and the rest, and
every resource survives a restart together.

### Imports: the driver and the ports it must satisfy

The driver is imported for side effects only (`_ "modernc.org/sqlite"`), which
registers it under the name `"sqlite"` for `sql.Open`. The capability packages
(`agent`, `chat`, `comment`, `file`, `organization`, `persona`, `reference`,
`resource`, `workspace`) are imported purely so the assertions at the bottom of
the file can name their store interfaces.

### Timestamp layouts, and why there are two

Timestamps are stored as RFC3339 text so the database file stays portable and
readable. `timeLayout` is `time.RFC3339Nano`, used almost everywhere. But
RFC3339Nano *trims trailing zeros* from the fractional second, which breaks any
query that compares timestamps lexically — a range scan like `run_at <= ?` would
order strings of differing width incorrectly. `sortableTimeLayout` pins the
fraction to a fixed nine digits so lexical order matches chronological order:

```go
const sortableTimeLayout = "2006-01-02T15:04:05.000000000Z07:00"
```

`sortableTime` normalizes to UTC and formats with that layout. It is used
wherever SQL compares or orders on the stored text — the jobs table's `run_at`,
and the activity feed's keyset pagination. Values written this way still read
back with `time.Parse(timeLayout, ...)`, so the two layouts interoperate.

### The Store type

`Store` wraps a single `*sql.DB`. Everything else in the package is a method on
it, which is what lets one value satisfy many unrelated interfaces without any
composition or embedding.

### Open: create, configure, migrate

`Open` creates the parent directory if needed, opens the database through
`pragmaDSN`, sizes the pool, pings to force a real connection (so a bad path
fails here rather than at the first query), and then runs `migrate` before
returning. A `Store` handed back from `Open` is therefore always against an
up-to-date schema — there is no separate "apply migrations" step for callers to
forget.

### maxOpenConns: read concurrency without pretending writes are concurrent

The pool is capped at 8. Under WAL, readers do not block the writer, so several
reads genuinely run in parallel; writes still serialize on SQLite's single
writer regardless of pool size, so a larger cap would only add contention.

### pragmaDSN: WAL, busy_timeout, and immediate transactions

`pragmaDSN` turns a plain filesystem path into a `file:` URI carrying three
settings applied on every connection:

```go
return "file:" + dsn + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_txlock=immediate"
```

WAL journaling is what gives readers concurrency with the writer. `busy_timeout`
makes a connection that finds the write lock held *wait* up to five seconds
rather than immediately return `SQLITE_BUSY`.

`_txlock=immediate` is the subtle one, and it is a correctness setting rather
than a performance one. By default SQLite begins a transaction *deferred*: the
write lock is only taken at the first write, so two transactions can both read,
both decide what to write from that read, and then collide — one of them having
based its write on a snapshot the other has already invalidated. `immediate`
makes `BEGIN` take the write lock up front, so a read-then-write transaction
holds the lock across both halves. That is exactly the shape of change-set
sequence assignment (read the current head, then append at head+1) and of job
claiming (find a runnable job, then mark it claimed); with `immediate` those
cannot interleave and race on a stale read.

A DSN that is already a `file:` URI or an in-memory database is returned
unchanged, so callers with their own parameters — and tests using `:memory:` —
are left alone. `Close` then closes the underlying `*sql.DB`, and with it the
pool.

### rowScanner: one scan routine for single rows and result sets

`Scan(dest ...any) error` is the one method `*sql.Row` and `*sql.Rows` have in
common, so declaring it as an interface lets a single row-decoding helper serve
both a lookup-by-ID (which yields a `*sql.Row`) and a list query's loop (which
yields `*sql.Rows`). It lives here because the capability files share it.

### boolToInt

SQLite has no boolean type; flags are stored as `INTEGER` 0/1. This converts on
the way in, and is shared rather than repeated per file.

### Compile-time interface assertions

The file ends with a block of `var _ X = (*Store)(nil)` declarations — for
`agent.TaskStore`, `chat.ChatStore`, `chat.AttachmentStore`, `workspace.Store`,
`comment.Store`, `file.Store`, `organization.Store`, `persona.Store`,
`reference.Store`, and `resource.AttributeStore`. Each costs nothing at runtime
but fails the build if `*Store` stops satisfying that port. Now that the methods
are spread across many files, these assertions are the single place that proves
the split still adds up to one type implementing every interface: delete or
rename a method in `sqlite_persona.go` and the compiler reports it here.

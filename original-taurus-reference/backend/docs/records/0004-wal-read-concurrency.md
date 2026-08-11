# 0004 — WAL + connection pool for read concurrency

Storage ran on a **single connection** (`SetMaxOpenConns(1)`): every database
operation, reads included, serialized through it. That sidestepped "database is
locked" errors but meant reads could not run concurrently — the practical half of
weakness #7. With re-base now off the request path (record 0003), softening this
is the next cheap step.

## core/storage/sqlite — WAL, a pool, and immediate transactions

The change is confined to `Open`: the DSN now carries pragmas, and the pool is
opened up.

```go
// pragmaDSN turns a plain database path into a modernc DSN that applies, on every
// connection: WAL journaling (readers do not block the writer), a busy timeout (a
// contended write waits instead of erroring), and immediate transactions (BEGIN
// takes the write lock up front). A DSN that is already a file: URI or in-memory
// is returned unchanged.
func pragmaDSN(dsn string) string {
	if strings.HasPrefix(dsn, "file:") || strings.Contains(dsn, ":memory:") {
		return dsn
	}
	return "file:" + dsn + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_txlock=immediate"
}
```

Three pieces work together:

- **WAL** (`journal_mode=WAL`) lets readers proceed concurrently with a writer,
  so a pool actually buys read concurrency. `SetMaxOpenConns(8)` replaces the
  single connection.
- **busy_timeout** makes a write that finds the lock held **wait** (up to 5s)
  rather than fail with `SQLITE_BUSY`.
- **`_txlock=immediate`** is the correctness linchpin. The two read-then-write
  transactions — `AppendChangeSet` (`SELECT MAX(seq)+1` then `INSERT`) and
  `ClaimDue` (`SELECT` a queued job then `UPDATE` it running) — must take the
  write lock at `BEGIN`. With the old default (deferred) and more than one
  connection, two writers could both read the same `MAX(seq)`, then one upgrades
  and the other races on a **stale** read — assigning a duplicate seq. Immediate
  transactions serialize them at `BEGIN` so each reads a fresh value.

Writes still serialize on SQLite's one writer; this does not change that (the
fundamental single-writer limit — a client-server database — remains future
work). What it removes is reads (the common path) queuing behind each other and
behind writes.

## Test

`TestConcurrentAppendAssignsUniqueSeqs` runs 8 concurrent writers × 25 appends to
one document and asserts the seqs are **unique and contiguous** (1..200) — which
fails if `BEGIN` does not take the write lock up front. It passes under `-race`,
confirming the immediate-transaction seq assignment is correct under the pool.

## Still deferred

The single **writer** (and thus no multi-node) is inherent to SQLite; moving to a
client-server database (e.g. Postgres) is the remaining, larger step, to be taken
only when write throughput or horizontal scale actually demands it.

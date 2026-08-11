# sqlite_jobs.go

The durable job queue's persistence: enqueue, claim, and the terminal and retry
transitions for `job.Job`. This is not a separate store — every file in the
package shares one `*Store` and one connection, and the split is organizational,
mirroring the capability boundaries in `core/capability`.

A job row is a small state machine (`queued` → `running` → `done` / `failed`,
with `failed`-then-`queued` retries) plus a `run_at` due time and an `attempts`
counter. Durability is the point: because the queue lives in the same SQLite file
as everything else, work survives a restart, and a worker that dies mid-job
leaves a recoverable `running` row rather than a lost task.

Two things make the queue safe under more than one worker. First, `run_at` is
written with `sortableTime` — the fixed-width `sortableTimeLayout` rather than
`timeLayout`. `time.RFC3339Nano` trims trailing zeros from the fractional second,
which would make lexical comparison of the stored text disagree with chronological
order and break the `run_at <= ?` due-window scan; the fixed-width layout keeps
string order and time order identical, and `time.Parse(timeLayout, …)` still reads
it back. Second, the select-then-claim in `ClaimDue` happens inside one immediate
transaction, so two workers cannot both see the same row as available.

## Code breakdown

### File header and imports

States the shared-`*Store` invariant, then imports `database/sql`,
`encoding/json` (payloads are stored as raw JSON text), `errors`, `time`, and
`core/platform/job` for the job type, statuses, and `ErrNotFound`.

### Enqueue — insert a job row

A single insert of every field the caller supplied, returning the job unchanged.
The store assigns nothing: the id, status, attempt budget, and due time all come
from the caller. `run_at` uses `sortableTime`; `created_at`/`updated_at` use
`timeLayout`, since they are only ever displayed, never range-compared.

### ClaimDue — atomically take the earliest due job

The heart of the file. In one transaction it selects the earliest-due `queued`
job whose `run_at` has passed:

```go
`... WHERE status = ? AND run_at <= ? ORDER BY run_at LIMIT 1`
```

then increments `attempts`, sets the status to `running`, and commits. Because
`pragmaDSN` sets `_txlock=immediate`, `BEGIN` takes the write lock before the
read, so a second worker's claim cannot interleave between this select and its
update — under SQLite's single writer, no two workers ever claim the same job.
An empty queue is not an error: `job.ErrNotFound` from the scan becomes a
`(zero, false, nil)` return, so a polling worker just loops.

The attempt increment happens at *claim* time, not at failure time, which is what
makes a crashed job count against its budget rather than retrying forever.

### Complete, Fail, Retry, setJobStatus — the outbound transitions

`Complete` and `Fail` are one-liners over the shared `setJobStatus` helper, which
stamps a status, a last-error string, and `updated_at`. `Retry` is separate
because it also has to move the job back to `queued` *and* set a new `run_at` —
that is where a backoff schedule lands. None of the three touches `attempts`;
the count is already recorded by the claim.

### JobByID — point lookup

Reads one job by id through `scanJob`; a missing row is `job.ErrNotFound`.

### JobsByStatus and JobCounts — the observability read

The two reads nothing in the queue itself uses: they exist so an operator can see
the queue without holding a job id, which until now was the only way to learn
anything about a job at all.

`JobsByStatus` is one query with an optional filter, expressed as `WHERE (? = ''
OR status = ?)` so the same statement serves "just the failed ones" and "the whole
queue" without building SQL by hand. It orders `created_at DESC, id DESC` —
newest first, with the id as a stable tiebreak — and takes its `LIMIT` from
`job.ClampJobsPage`, so the bound is the queue package's, applied identically by
both stores, and no caller can ask for the whole table. Ordering is over the
stored `created_at` text, as everywhere else in this store (only `run_at`, which
is range-compared, needs the fixed-width sortable layout).

`JobCounts` is a plain `GROUP BY status` tallied into `map[job.Status]int`. A
status with no rows is simply absent from the map; the HTTP layer fills the zeros
in, so the wire shape stays fixed while the query stays trivial.

### ReapStale — recover jobs orphaned by a crash

Requeues every job still marked `running` whose `updated_at` predates a cutoff —
the signature of a worker that died holding it. It sets `run_at` to the same
cutoff so the job is immediately due again, and deliberately leaves `attempts`
alone, so a job that keeps killing its worker exhausts its budget instead of
looping forever. Returns the number of rows reclaimed, for logging.

### scanJob — one scan routine for both row shapes

Takes a `rowScanner`, so the same code serves `JobByID`'s single row, the row
`ClaimDue` reads inside its transaction, and each row of the `JobsByStatus`
listing. Wraps the payload as
`json.RawMessage` (it is passed through opaquely, never inspected here), converts
the status text to `job.Status`, parses the three timestamps with `timeLayout` —
which reads the sortable `run_at` correctly too — and maps `sql.ErrNoRows` to
`job.ErrNotFound`.

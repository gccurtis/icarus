# 0003 — Background jobs system

Re-basing a document ran **in the request path**: the append that crossed the
threshold also folded every pending change set into a new base, holding the single
SQLite writer while it worked. This adds a small, durable **jobs system** and moves
re-base (and history pruning) onto it, off the hot path.

The model, settled with the user: a hardcoded **operation → synctype map** decides,
per operation, whether it is handled **synchronously** (run inline on the request's
own goroutine — reads and edits that carry a synchronous contract like a returned
`seq` or a `409`) or **asynchronously** (turned into a job, enqueued, answered with
`202` and a job id). Jobs are independent and order-insensitive, so the system is
deliberately simple: a queue, a worker pool, and retry with backoff.

## core/job (new package)

### job.go — Job, Store, Registry, Queue, Enqueuer

A `Job` is `{id, type, payload, status, attempts, maxAttempts, lastError, runAt,
timestamps}`; `Payload` is opaque JSON the type's handler decodes. A `Store`
persists jobs and, crucially, **atomically claims** the next due one. A `Registry`
maps a job type to its `Handler`. A `Queue` is the enqueue side (marshals a payload,
stores a queued job) and satisfies the narrow `Enqueuer` seam other packages depend
on.

```go
// Enqueuer submits jobs. It is the narrow seam other packages depend on to
// schedule background work without knowing how jobs are stored or run.
type Enqueuer interface {
	Enqueue(ctx context.Context, typ string, payload any) (Job, error)
}
```

**Why an interface:** the document service schedules a re-base without importing the
storage or pool machinery — it only needs "enqueue this".

### pool.go — the worker pool

`Pool` runs N workers. Each claims a due job, runs its handler (a panic is recovered
into an error so one bad job cannot fell a worker), and on success completes it, or
on failure either reschedules it with **exponential backoff** (`base·2^(n-1)`, capped)
or, past `maxAttempts`, marks it failed.

```go
func (p *Pool) run(ctx context.Context, j Job) {
	h, ok := p.reg.Handler(j.Type)
	if !ok {
		p.logf("job %s: no handler for type %q", j.ID, j.Type)
		_ = p.store.Fail(j.ID, "no handler for type "+j.Type)
		return
	}

	err := runHandler(ctx, h, j.Payload)
	if err == nil {
		_ = p.store.Complete(j.ID)
		return
	}
	// j.Attempts already counts this run (ClaimDue incremented it).
	if j.Attempts >= j.MaxAttempts {
		p.logf("job %s (%s): failed after %d attempts: %v", j.ID, j.Type, j.Attempts, err)
		_ = p.store.Fail(j.ID, err.Error())
		return
	}
	_ = p.store.Retry(j.ID, err.Error(), p.now().UTC().Add(p.backoff(j.Attempts)))
}
```

`Start(ctx)` launches the workers; `Wait()` blocks until they exit after `ctx` is
cancelled — this is how the composition root drains jobs on shutdown.

### memory.go — in-memory Store for tests

Mirrors the SQLite store's claim semantics (pick the earliest-due queued job, mark
it running, bump attempts) so unit tests exercise the same behavior without a
database.

## core/storage/sqlite — the durable job store

A `jobs` table plus the `job.Store` methods. The **claim** is one transaction —
select the earliest due queued job, mark it running — which under our single writer
means no two workers ever claim the same job, with no locking gymnastics.

```go
// ClaimDue selects the earliest-due queued job and marks it running in one
// transaction, so under the single writer no two workers claim the same job.
func (s *Store) ClaimDue(now time.Time) (job.Job, bool, error) {
```

`run_at` is stored with a **fixed-width fractional second** (`sortableTimeLayout`),
because `time.RFC3339Nano` trims trailing zeros — which would make the `run_at <= ?`
range query compare wrong. `PruneChangeSets` (also added here) deletes a document's
**folded** change sets beyond the newest `keep`, never touching pending ones.

## core/document — re-base becomes a job

`AppendChanges` no longer folds inline. At the threshold it **enqueues** a
`document.rebase` job (best effort — the change set is already durably recorded) and
returns its `201` + `seq` unchanged.

```go
	if d.enqueuer != nil {
		if all, err := d.store.ChangeSetsSince(id, doc.BaseSeq); err == nil && len(all) >= d.rebaseThreshold {
			_, _ = d.enqueuer.Enqueue(context.Background(), JobTypeRebase, rebasePayload{ProjectID: projectID, DocumentID: id})
		}
	}
```

`Rebase(ctx, projectID, documentID)` is the job body: project-scoped, it folds
pending change sets into a new base and, if a history limit is configured, prunes
folded change sets beyond it. It is **idempotent** — nothing pending is a no-op — so
a double-run (or a redundant enqueue) is harmless. `New` now takes an `Options`
carrying the threshold, the history limit, and the `Enqueuer`.

## core/transport — the synctype map and async dispatch

The operation → synctype map is the single source of truth:

```go
var operationSync = map[string]syncType{
	"documents.list":           dispatchSync,
	"documents.create":         dispatchSync,
	"documents.get":            dispatchSync,
	"documents.delete":         dispatchSync,
	"documents.append_changes": dispatchSync,
	"documents.rebase":         dispatchAsync,
}
```

`dispatchScoped` reads the map and installs either the inline handler (the "sync
runner") or the async path, panicking if the wiring and the map disagree — so they
cannot silently drift. `adaptAsync` authorizes the request, enqueues the job from an
`asyncSpec`, and answers `202` with the job id. Re-base is exposed as the first async
endpoint, `POST /documents/:documentID/rebase`, and `GET /jobs/:jobID` (via a new
`core/application/job` handler) lets a client poll a job id — returning only its
lifecycle fields, never the payload.

## core/composition & config

A `jobs` config section (`workers`, `poll_interval`, `max_attempts`) tunes the pool.
Composition builds one `job.Queue` over the same store, registers `document.rebase →
docs.RebaseJob`, starts the pool on a cancelable context, and on shutdown drains the
HTTP listener, then cancels the pool and waits for in-flight jobs to finish.

## Tests

- `core/job`: the pool runs a job to done, retries a failing one to `failed` after
  its attempt limit, and fails an unknown type.
- `core/storage/sqlite`: the job store round-trips, `ClaimDue` respects `run_at`
  (a future job is not claimed early; a retry reschedules), and `PruneChangeSets`
  keeps pending + the newest folded change sets.
- `core/document`: an append enqueues exactly one re-base job at the threshold;
  `Rebase` folds and keeps history (idempotent) and prunes beyond the limit.
- `core/transport`: re-base returns `202` + a pollable job id; unknown job → `404`;
  the status endpoint is gated.
- `dev-test/jobs`: drives the whole async flow over HTTPS against real SQLite and a
  live worker pool, polling the job to `done`.

## Deferred / follow-ups

- **#7 (single-writer serialization):** revisit after this — with re-base off the
  request path, the worst offender is gone; WAL + a connection pool for read
  concurrency is the next cheap step if contention shows up.
- Job **status authorization** is currently "any signed-in user who holds the opaque
  job id"; tying jobs to their enqueuing user/project is a future refinement.
- Backoff base/cap are fixed constants, not yet config.

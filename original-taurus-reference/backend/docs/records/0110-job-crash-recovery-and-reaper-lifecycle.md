# 0110 — Job crash-recovery (BUG-2) & task-reaper lifecycle (BUG-3)

Two durability/lifecycle fixes from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)), both test-first.

## Why

**BUG-2.** The job pool claims a job by marking it `running`, but nothing ever
returned a `running` job to the queue. `ClaimDue` only selects `queued`, and the
one stale-reclaimer in the codebase (`ReapStaleTasks`) is for agent *tasks*, not
the `jobs` table. So a hard crash while a job was running stranded it in `running`
forever — a real hole under the "durable jobs" headline.

**BUG-3.** The agent task reaper was a bare `go func(){ for range ticker.C {...} }`
with no context or stop channel. It ran forever and, on shutdown, could call the
store as `store.Close()` ran — a goroutine leak and a close race, unlike the
session and connector-detector loops which are lifecycle-bound.

## `core/platform/job/job.go`

### `Store.ReapStale`

Adds `ReapStale(before time.Time) (int, error)` to the job `Store` port: return
every job running since before the given time back to queued (due immediately),
reporting how many. **Attempts are preserved**, so a job that repeatedly kills its
worker still exhausts its attempts and fails rather than looping forever.

## `core/platform/storage/sqlite/sqlite.go` & `core/platform/job/memory.go`

Both stores implement `ReapStale`: a single `UPDATE ... SET status='queued' WHERE
status='running' AND updated_at < ?` in SQLite, the equivalent scan in the
in-memory store. `updated_at` is the lease clock — `ClaimDue` stamps it when a
worker takes the job, so a job silent past the threshold is treated as orphaned.

## `core/platform/job/pool.go`

### Startup recovery + periodic reaper

```go
	// Crash recovery: a single-instance cell has no job legitimately running
	// before its workers launch, so requeue any left running by a prior process.
	if n, err := p.store.ReapStale(p.now().UTC()); err != nil {
```

`Start` now (1) requeues **all** running jobs before launching workers — a
single-instance cell has none legitimately running yet, so this cleanly recovers a
prior crash's orphans — and (2) launches a `reap` goroutine that periodically
requeues jobs running past a lease. New `Options.Lease` (default 15m, must exceed
the slowest job so a working job is never requeued underneath itself) and
`Options.ReapInterval` (default 1m). The reaper joins the pool's `WaitGroup`, so
`Wait()` covers it on shutdown.

## `core/capability/agent/task.go`

### `StartReaper` is context-bound

```go
func (t *Tasks) StartReaper(ctx context.Context, interval, staleAfter time.Duration) {
	...
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = t.store.ReapStaleTasks(t.now().Add(-staleAfter))
		}
}
```

The loop now selects on `ctx.Done()` and returns on cancellation instead of
looping forever.

## `core/wiring/wiring.go`

The reaper start moved from just after `agent.NewTasks(...)` (before any shutdown
context existed) to just after `pool.Start(jobCtx)`, now passed `jobCtx` — the
same context `jobCancel()` cancels on shutdown, alongside the pool and the
connector detector. So `jobCancel()` stops the reaper before the deferred
`store.Close()` runs.

## Tests (all written first, red before the fix)

- `core/platform/job/job_test.go` — `TestReapStaleRequeuesOrphanedRunningJobs`
  (store-level: orphan requeued with attempts preserved, live job untouched) and
  `TestPoolRequeuesOrphanedJobOnStart` (a job stuck running from a prior process is
  recovered and run at startup).
- `core/platform/storage/sqlite/sqlite_test.go` — `TestJobReapStale` (the SQLite
  reaper requeues the orphan, claimable again, and leaves the live job alone).
- `core/capability/agent/reaper_test.go` — `TestStartReaperStopsWhenContextCancelled`
  (the reaper stops ticking once its context is cancelled).

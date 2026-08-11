# `document_purge.go`

The background loop that reclaims trashed documents once their retention has
elapsed.

Deleting a document moves it to trash; it becomes eligible for permanent removal
only after `documents.trash_retention` (default 720h) has passed. Actually
removing it is maintenance, and maintenance has two properties this file exists
to satisfy: it must not sit on the boot path, and it must keep happening for as
long as the process runs.

Before this file, `Run` called `docs.PurgeStale()` synchronously during
composition. That delayed readiness by however long the sweep took, and — less
obviously — meant a long-lived cell purged **exactly once**, at startup: trash
accumulated for the rest of the process's life no matter how much built up.

## Code breakdown

### The sweep interval

`trashPurgeInterval` is one hour. Retention is measured in days, so an hourly
sweep is far finer-grained than the deadline it enforces while keeping the work
negligible — most sweeps find nothing.

### `stalePurger` — the one operation the loop needs

```go
type stalePurger interface {
	PurgeStale() error
}
```

A one-method port rather than a `*document.Documents`. It keeps the loop
testable without constructing a document service and a store, and states plainly
that this file's reach into the document capability is a single operation. The
canonical `*document.Documents` satisfies it directly, so `Run` passes the
service with no adapter.

### `runTrashPurge` — sweep at startup, then on every tick

Purges once immediately (so a process that restarts frequently still reclaims
trash promptly), then selects on the ticker and `ctx.Done()` until cancelled.

Two deliberate choices:

- **A failed sweep is logged, never fatal.** Purging is best-effort maintenance;
  a transient store error must not take down a serving process. The next tick
  retries.
- **It is bound to a context**, and `Run` starts it with `jobCtx` — the same
  context that stops the job pool, the task reaper, and the connector detector.
  So it shuts down with everything else rather than outliving the store it
  writes to.

# job.go

`job.go` defines the vocabulary of a small, durable background-jobs system: what a
job *is*, where it is stored, and how work is submitted and dispatched. A job is a
unit of work with a type and an opaque JSON payload; it is enqueued into a `Store`
and run later by a worker pool, off the request path. This file holds the core
types — `Job`, `Status`, `Handler`, `Store`, `Enqueuer` — plus the two concrete
pieces that live on the enqueue and dispatch seams: the `Queue` that submits work
and the `Registry` that maps job types to their handlers.

The design is deliberately spare. Jobs are independent and order-insensitive, so
there is no dependency graph, no priorities, no fan-out — just a queue, a handful
of workers, and retry with backoff. The interfaces here are the seams that keep
that simplicity honest: other packages depend only on the narrow `Enqueuer` to
schedule work, and the storage details sit behind `Store` so an in-memory store
and a SQLite store are interchangeable. The one invariant everything else leans on
is stated on `Store.ClaimDue`: claiming a due job must be atomic, so two workers
never run the same job.

## Code breakdown

### Package documentation and declaration

```go
// Package job is a small, durable background-jobs system. A job is a unit of
// work with a type and a JSON payload; it is enqueued into a Store and run later
// by a worker Pool, off the request path. Handlers are looked up by type in a
// Registry, and failures are retried with backoff up to a per-job attempt limit.
//
// The system is deliberately simple: jobs are independent and order-insensitive,
// so there is no dependency graph or priority — just a queue, a handful of
// workers, and retry. Work that must answer a request synchronously does not
// belong here; jobs are for deferrable work (re-basing a document, pruning
// history, and later, sending mail or calling webhooks).
package job
```

The doc comment sets the scope of the whole package in one place: what a job is,
the path it travels (enqueue into a `Store`, run later by a `Pool`), and the two
policies that shape it (handler lookup by type, retry with backoff up to a limit).
It also draws the boundary line — synchronous request work does not belong here —
and names the kind of deferrable work jobs are for, so a reader knows when to reach
for this system and when not to.

### Imports

```go
import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sync"
	"time"
)
```

`context` threads cancellation into handlers and the enqueue call, `crypto/rand`
and `encoding/hex` generate job ids, `encoding/json` carries the opaque payload,
`errors` defines the sentinel `ErrNotFound`, `sync` guards the registry map for
concurrent use, and `time` stamps jobs and schedules their `RunAt`.

### Job status lifecycle

```go
// Status is where a job is in its lifecycle.
type Status string

const (
	// StatusQueued is waiting to run (or waiting to retry after a failure).
	StatusQueued Status = "queued"
	// StatusRunning is claimed by a worker and executing.
	StatusRunning Status = "running"
	// StatusDone completed successfully.
	StatusDone Status = "done"
	// StatusFailed exhausted its attempts and will not run again.
	StatusFailed Status = "failed"
)
```

`Status` is a string enum naming the four states a job moves through. Modeling it
as a named string type (rather than a bare `string`) makes the states self-documenting
in signatures and stored values while remaining trivially JSON- and SQL-friendly.
The two resting states are worth noting: `StatusQueued` covers both the first run
and every wait-to-retry between failures, and the terminal states — `StatusDone`
and `StatusFailed` — are the only ones from which a job never runs again.

### Default attempt limit and the not-found sentinel

```go
// DefaultMaxAttempts is how many times a job is tried before it is marked failed,
// used when a job is enqueued without its own limit.
const DefaultMaxAttempts = 5

// ErrNotFound is returned when a job id does not exist.
var ErrNotFound = errors.New("job not found")
```

`DefaultMaxAttempts` is the fallback retry cap applied when an enqueuer does not
specify one, keeping a single sensible policy in one place. `ErrNotFound` is the
sentinel every `Store` returns for an unknown id; exposing it as a package-level
value lets callers use `errors.Is` to distinguish a missing job from a real
storage failure — which the HTTP job-status handler relies on to answer 404 versus
500.

### The page bound on listing jobs

`MaxJobsPage` (200) and `ClampJobsPage` are the queue's own limit on an
observability read. Listing jobs is a debugging affordance, not a data export, so
no caller — however large a `limit` it passes, or none at all — can pull the whole
table:

```go
func ClampJobsPage(limit int) int {
	if limit < 1 || limit > MaxJobsPage {
		return MaxJobsPage
	}
	return limit
}
```

The clamp lives here rather than in each store so both implementations bound the
read identically, and so the bound is stated once, next to the interface that
promises it.

### The Job type

```go
// Job is one unit of background work. Payload is an opaque JSON document the
// handler for Type knows how to decode; the queue never interprets it.
type Job struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	Payload     json.RawMessage `json:"-"`
	Status      Status          `json:"status"`
	Attempts    int             `json:"attempts"`
	MaxAttempts int             `json:"maxAttempts"`
	LastError   string          `json:"lastError,omitempty"`
	RunAt       time.Time       `json:"-"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}
```

`Job` is the record that carries a unit of work through the whole system. `Type`
selects the handler, and `Payload` is the handler's opaque input — held as
`json.RawMessage` so the queue passes it through without ever decoding it, which
keeps the queue ignorant of any particular job's shape. The bookkeeping fields
track the lifecycle: `Status`, the `Attempts`/`MaxAttempts` pair that drives the
retry cap, `LastError` for the most recent failure, and the three timestamps.
Two fields are tagged `json:"-"` so they never leave the process over the wire:
`Payload` (it may hold internal ids the status endpoint deliberately does not
expose) and `RunAt` (the scheduling detail). `LastError` is `omitempty` so a job
that has never failed carries no error field.

### The Handler type

```go
// Handler runs a job's work. It receives the job's payload and returns an error
// to signal the run should be retried (or, past the attempt limit, failed).
type Handler func(ctx context.Context, payload json.RawMessage) error
```

`Handler` is the contract for the code that actually does a job's work. It is a
plain function taking a context and the raw payload, and its *error return is the
control signal*: `nil` means the job is done, and any non-nil error tells the pool
to retry — or, once attempts are exhausted, to fail the job. Because a handler
receives only the payload and returns only an error, it stays decoupled from the
queue's bookkeeping; deciding what a failure means is the pool's job, not the
handler's.

### The Store interface

```go
// Store persists jobs and hands them to workers. Its ClaimDue must atomically
// select a due job and mark it running, so two workers never claim the same job.
type Store interface {
	// Enqueue stores a new job as queued.
	Enqueue(j Job) (Job, error)
	// ClaimDue atomically claims the earliest queued job whose RunAt is at or
	// before now, marking it running and incrementing its attempts. The bool is
	// false when nothing is due.
	ClaimDue(now time.Time) (Job, bool, error)
	// Complete marks a running job done.
	Complete(id string) error
	// Retry returns a job to queued with a new RunAt (a backoff) and records the
	// error that caused the retry.
	Retry(id, lastErr string, runAt time.Time) error
	// Fail marks a job failed terminally, recording the final error.
	Fail(id, lastErr string) error
	// JobByID returns a job by id, or ErrNotFound.
	JobByID(id string) (Job, error)
	// JobsByStatus returns jobs with the given status, newest first, bounded.
	JobsByStatus(status Status, limit int) ([]Job, error)
	// JobCounts returns how many jobs are in each status.
	JobCounts() (map[Status]int, error)
	// ReapStale returns every job that has been running since before the given
	// time back to queued (due immediately), so work orphaned by a crash runs
	// again. It reports how many jobs were requeued. Attempts are preserved, so a
	// job that repeatedly kills its worker still eventually exhausts them and
	// fails rather than looping forever.
	ReapStale(before time.Time) (int, error)
}
```

`Store` is the persistence seam, and its method set mirrors the job lifecycle
exactly: `Enqueue` to add work, `ClaimDue` to take it, and `Complete`/`Retry`/`Fail`
to record its outcome, with `JobByID` for read-only status lookups.

`JobsByStatus` and `JobCounts` are the **observability** pair, and they are read
methods the queue itself never uses — they exist for the operator, not the pool.
Without them a `failed` job is invisible: you must already hold its id to see it,
so a stuck queue or a run of failures is silent. `JobsByStatus` filters (an empty
status means any), orders newest-first by creation, and is always bounded through
`ClampJobsPage`; `JobCounts` summarises the whole table, and may omit a status
with no rows, which is why the handler fills the zeros in. `ReapStale` is
the crash-recovery seam: it sweeps jobs stuck in running since before a cutoff back
to queued and due immediately, so work whose worker died mid-run is retried rather
than stranded; it preserves each job's `Attempts`, so a job that keeps killing its
worker still eventually exhausts its limit and fails instead of looping forever. The
load-bearing
promise is on `ClaimDue`: it must *atomically* select the earliest due queued job,
mark it running, and increment its attempts. That atomicity is what lets several
workers poll the same store concurrently without ever double-running a job — the
whole concurrency model rests on it, which is why both the SQLite store (via a
transaction) and the in-memory store (via a mutex) must honor it identically.
The `bool` return distinguishes "claimed a job" from "nothing was due", so an
empty queue is not an error.

### The Enqueuer seam

```go
// Enqueuer submits jobs. It is the narrow seam other packages depend on to
// schedule background work without knowing how jobs are stored or run.
type Enqueuer interface {
	Enqueue(ctx context.Context, typ string, payload any) (Job, error)
}
```

`Enqueuer` is the deliberately minimal interface the rest of the codebase depends
on to schedule work. It exposes a single method — hand over a type and a payload,
get back the stored job — and nothing about storage, workers, or retry. Keeping
the submit side this narrow means an application package can schedule background
work while depending on almost nothing, and the concrete `Queue` can change freely
behind it.

### The Queue type and constructor

```go
// Queue is the enqueue side of the system: it marshals a payload and stores a
// new queued job with sensible defaults. It satisfies Enqueuer.
type Queue struct {
	store       Store
	maxAttempts int
	now         func() time.Time
}

// NewQueue builds a Queue over a Store. maxAttempts caps retries; values below 1
// fall back to DefaultMaxAttempts.
func NewQueue(store Store, maxAttempts int) *Queue {
	if maxAttempts < 1 {
		maxAttempts = DefaultMaxAttempts
	}
	return &Queue{store: store, maxAttempts: maxAttempts, now: time.Now}
}
```

`Queue` is the concrete enqueue side and the type that satisfies `Enqueuer`. It
holds the `Store` it writes to, the retry cap to stamp on new jobs, and a `now`
function — injected rather than calling `time.Now` directly so tests can control
the clock. `NewQueue` wires these together and guards the one bit of policy at the
door: a `maxAttempts` below 1 is nonsensical, so it falls back to
`DefaultMaxAttempts`, guaranteeing every job the queue creates carries a usable
limit.

### Enqueue

```go
// Enqueue marshals payload to JSON and stores a queued job of the given type,
// due immediately. It returns the stored job (whose ID identifies it thereafter).
func (q *Queue) Enqueue(ctx context.Context, typ string, payload any) (Job, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Job{}, err
	}
	now := q.now().UTC()
	return q.store.Enqueue(Job{
		ID:          newID(),
		Type:        typ,
		Payload:     raw,
		Status:      StatusQueued,
		MaxAttempts: q.maxAttempts,
		RunAt:       now,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
}
```

`Enqueue` turns a caller's typed value into a stored job. It marshals the payload
to JSON up front — so a payload that cannot be encoded fails fast, before anything
is stored — then builds a fully-formed `Job`: a fresh id, the caller's type and
payload, `StatusQueued`, the queue's attempt cap, and a `RunAt` of *now* so the job
is due immediately. All three timestamps are set to the same UTC instant for a
consistent record. It returns the stored job so the caller learns the id, which is
what async HTTP endpoints hand back in their 202 response for later polling.

### The Registry type and constructor

```go
// Registry maps job types to their handlers. It is written at startup (as the
// composition root registers each type) and read by the pool, so it is guarded
// for concurrent use.
type Registry struct {
	mu       sync.RWMutex
	handlers map[string]Handler
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{handlers: make(map[string]Handler)}
}
```

`Registry` is the lookup table from job type to `Handler`. Its access pattern —
written once at startup as the composition root registers each type, then read
repeatedly by pool workers — is exactly what an `sync.RWMutex` is for, so the map
is guarded to allow many concurrent reads. `NewRegistry` just returns one with an
initialized map, ready to be populated.

### Register and Handler lookup

```go
// Register binds a handler to a job type. A later registration for the same type
// replaces the earlier one.
func (r *Registry) Register(typ string, h Handler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[typ] = h
}

// Handler returns the handler for a type, and whether one is registered.
func (r *Registry) Handler(typ string) (Handler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	h, ok := r.handlers[typ]
	return h, ok
}
```

`Register` binds a handler to a type under the write lock; a repeat registration
simply overwrites, so last-writer-wins with no error. `Handler` is the read side
the pool uses to dispatch: it takes the read lock and returns the handler along
with an `ok` flag. That flag matters — a job whose type has no registered handler
is a real condition the pool must handle (it fails the job rather than crashing),
so the lookup reports presence rather than returning a nil handler.

### Generating job ids

```go
func newID() string {
	b := make([]byte, 16)
	// crypto/rand.Read never returns an error on the platforms we target.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
```

`newID` mints the identifier for each new job: 16 random bytes from `crypto/rand`
rendered as a 32-character hex string. Using a cryptographically random id makes
ids effectively collision-free without any central sequence or coordination. The
error from `rand.Read` is deliberately ignored, with a comment explaining why —
it does not fail on the targeted platforms — keeping the helper a clean one-liner
at its call sites.

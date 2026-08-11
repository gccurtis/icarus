# pool.go

`pool.go` is the run side of the jobs system: a `Pool` of workers that drain a
`Store`. Where `job.go` defines what a job is and how it is enqueued, this file is
the loop that actually executes them — off the request path, concurrently, and
resiliently. Each worker repeatedly claims a due job, looks up its handler, runs
it, and records the outcome: complete on success, and on failure either a retry
scheduled with exponential backoff or a terminal failure once the job's attempt
limit is reached.

The design goal is that one misbehaving job can never take down a worker or the
process. Handlers run inside a panic-recovering wrapper, storage errors are logged
and retried rather than fatal, and the whole pool shuts down cleanly when its
context is cancelled — workers notice cancellation both between claims and while
sleeping, and `Wait` lets the caller block until every worker has exited. The clock
and the logger are both injected so the pool is testable and quiet by default.

## Code breakdown

### Package declaration and imports

```go
package job

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)
```

`pool.go` is part of the same `job` package as the core types. `context` carries
the shutdown signal into workers and handlers, `encoding/json` types the payload
passed to a handler, `fmt` formats the panic-into-error message, `sync` provides
the `WaitGroup` that tracks live workers, and `time` drives polling, backoff, and
the sleep timer.

### Pool defaults

```go
// Pool defaults, used when Options leaves a field zero.
const (
	defaultWorkers      = 2
	defaultPollInterval = time.Second
	defaultBaseBackoff  = time.Second
	defaultMaxBackoff   = 5 * time.Minute
	// defaultLease is how long a job may be running (without completing) before
	// the reaper treats it as orphaned. It must comfortably exceed the longest
	// real job runtime so a still-working job is never requeued underneath itself.
	defaultLease = 15 * time.Minute
	// defaultReapInterval is how often the reaper sweeps for orphaned jobs.
	defaultReapInterval = time.Minute
)
```

These unexported constants are the fallback tuning for a pool. Keeping them in one
block documents the shape of the default policy at a glance: two concurrent
workers, poll once a second when idle, and a retry backoff that starts at one
second and is capped at five minutes. The reaper adds two more: a 15-minute lease —
how long a job may be running before it is treated as orphaned, set well above the
slowest real job so a still-working one is never requeued underneath itself — and a
one-minute sweep interval. They apply wherever `Options` (or the pool's own fields)
are left at their zero value.

### Options

```go
// Options configures a Pool.
type Options struct {
	// Workers is how many jobs run concurrently. Defaults to 2.
	Workers int
	// PollInterval is how long a worker waits before polling again when the queue
	// is empty. Defaults to 1s.
	PollInterval time.Duration
	// Logf logs a job that exhausts its attempts (and other worker-level events).
	// Defaults to a no-op.
	Logf func(format string, args ...any)
	// Lease bounds how long a job may run before the reaper considers it orphaned
	// and requeues it. Defaults to 15m. Set it above the slowest job.
	Lease time.Duration
	// ReapInterval is how often the pool sweeps for orphaned running jobs.
	// Defaults to 1m.
	ReapInterval time.Duration
}
```

`Options` is the caller-facing configuration surface, kept small on purpose. It
exposes the knobs a caller is likely to set — how many workers, how often to poll
an empty queue, where to send log output, and the reaper's lease and sweep interval
— and every field is optional, falling back to a sensible default when left zero.
Notably the backoff bounds are *not* exposed here; they are set from the defaults in
the constructor, so the tunable surface stays minimal. `Logf` matches the
`log.Printf` signature so a standard logger drops in directly.

### The Pool type

```go
// Pool runs a fixed set of workers that drain a job Store: each worker claims a
// due job, runs its handler, and either completes it or schedules a retry with
// exponential backoff — until the job's attempt limit is reached, at which point
// it is failed.
type Pool struct {
	store        Store
	reg          *Registry
	workers      int
	poll         time.Duration
	baseBackoff  time.Duration
	maxBackoff   time.Duration
	logf         func(format string, args ...any)
	now          func() time.Time
	lease        time.Duration
	reapInterval time.Duration
	wg           sync.WaitGroup
}
```

`Pool` holds everything the workers need: the `Store` to draw work from and the
`Registry` to resolve handlers, plus the resolved tuning values (`workers`, `poll`,
the two backoff bounds, and the reaper's `lease`/`reapInterval`) and the injected
`logf`/`now` seams. The `WaitGroup` tracks how many workers — and the reaper — are
still alive so `Wait` can block until shutdown completes. Storing the backoff
bounds and the clock on the struct — rather than reading globals — is what makes the
retry timing deterministic under test.

### NewPool

```go
// NewPool builds a Pool over a store and registry.
func NewPool(store Store, reg *Registry, opts Options) *Pool {
	p := &Pool{
		store:        store,
		reg:          reg,
		workers:      opts.Workers,
		poll:         opts.PollInterval,
		baseBackoff:  defaultBaseBackoff,
		maxBackoff:   defaultMaxBackoff,
		logf:         opts.Logf,
		now:          time.Now,
		lease:        opts.Lease,
		reapInterval: opts.ReapInterval,
	}
	if p.workers < 1 {
		p.workers = defaultWorkers
	}
	if p.poll <= 0 {
		p.poll = defaultPollInterval
	}
	if p.lease <= 0 {
		p.lease = defaultLease
	}
	if p.reapInterval <= 0 {
		p.reapInterval = defaultReapInterval
	}
	if p.logf == nil {
		p.logf = func(string, ...any) {}
	}
	return p
}
```

`NewPool` assembles a pool and normalizes its `Options` so the worker loop never
has to. It seeds the backoff bounds from the package defaults and the clock from
`time.Now`, copies the caller's options in, then repairs any that are unusable: a
non-positive worker count or poll interval falls back to its default, a non-positive
lease or reap interval falls back to the reaper defaults, and a nil `Logf` becomes a
no-op function. That last substitution matters — it lets the worker code call
`p.logf(...)` unconditionally without nil-checking, and makes the pool silent by
default.

### Start and Wait

```go
// Start launches the workers and the reaper. They run until ctx is cancelled;
// call Wait to block until they have all exited.
func (p *Pool) Start(ctx context.Context) {
	// Crash recovery: a single-instance cell has no job legitimately running
	// before its workers launch, so requeue any left running by a prior process.
	if n, err := p.store.ReapStale(p.now().UTC()); err != nil {
		p.logf("job: startup reap failed: %v", err)
	} else if n > 0 {
		p.logf("job: requeued %d orphaned job(s) at startup", n)
	}
	for i := 0; i < p.workers; i++ {
		p.wg.Add(1)
		go p.work(ctx)
	}
	p.wg.Add(1)
	go p.reap(ctx)
}

// Wait blocks until every worker has stopped (after ctx is cancelled).
func (p *Pool) Wait() { p.wg.Wait() }
```

`Start` first does a startup crash recovery: because a single-instance cell has no
job legitimately running before its workers launch, it calls `ReapStale` with the
current time to requeue anything a prior process left mid-run (logging how many, or
a failure). It then launches the fixed set of worker goroutines plus one reaper
goroutine, registering each with the `WaitGroup` before it spawns so there is no
race between `Add` and a `Done`. It returns immediately — everything runs in the
background until `ctx` is cancelled. `Wait` is the shutdown companion: it blocks on
the `WaitGroup` until every worker (and the reaper) has drained and exited, giving
the caller a clean "pool has fully stopped" signal to sequence against the rest of
shutdown.

### The reaper

```go
// reap periodically returns jobs that have been running past the lease to the
// queue, so work orphaned by a worker that died mid-run (without a clean
// shutdown) is retried rather than stranded.
func (p *Pool) reap(ctx context.Context) {
	defer p.wg.Done()
	for {
		if !p.sleep(ctx, p.reapInterval) {
			return
		}
		if n, err := p.store.ReapStale(p.now().UTC().Add(-p.lease)); err != nil {
			p.logf("job: reap failed: %v", err)
		} else if n > 0 {
			p.logf("job: requeued %d stale running job(s)", n)
		}
	}
}
```

`reap` is the ongoing counterpart to the startup recovery: it runs for the life of
the pool, sweeping on each `reapInterval` tick for jobs still running past the
lease. Where the startup pass uses *now* as the cutoff (nothing should be running
yet), the periodic pass uses `now - lease`, so only jobs that have been running
longer than the lease — evidence of a worker that died mid-run without a clean
shutdown — are returned to the queue. It shares the workers' cancellable `sleep`, so
a cancelled context stops it promptly and its `defer p.wg.Done()` lets `Wait`
account for it during shutdown.

### The worker loop

```go
func (p *Pool) work(ctx context.Context) {
	defer p.wg.Done()
	for {
		if ctx.Err() != nil {
			return
		}
		j, ok, err := p.store.ClaimDue(p.now().UTC())
		if err != nil {
			p.logf("job: claim failed: %v", err)
			if !p.sleep(ctx, p.poll) {
				return
			}
			continue
		}
		if !ok {
			if !p.sleep(ctx, p.poll) {
				return
			}
			continue
		}
		p.run(ctx, j)
	}
}
```

`work` is the loop each worker runs. Its `defer p.wg.Done()` guarantees the
`WaitGroup` is decremented no matter how the loop exits. Every iteration first
checks for cancellation, then tries to claim a due job. The two "nothing to do
right now" paths — a claim error, and an empty queue (`!ok`) — both back off by
sleeping for the poll interval before looping again; the difference is that a claim
error is logged first, since it signals a storage problem rather than an idle
queue. In both cases, if the sleep is interrupted by cancellation the worker
returns. When a job is claimed, control passes to `run`. Cancellation is thus
observed at three points — the top-of-loop check and each of the two sleeps — so a
worker stops promptly whether it is busy-looping, idle, or backing off.

### Running a single job

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

`run` executes one claimed job and records its outcome, and it encodes the whole
success/retry/fail policy. First it resolves the handler; a job whose type has no
handler cannot ever run, so it is failed terminally rather than retried. Otherwise
it invokes the handler through `runHandler` and branches on the result: no error
completes the job. On error it consults the attempt count — and the comment flags
the key subtlety, that `ClaimDue` already incremented `Attempts` to include this
run, so the comparison `j.Attempts >= j.MaxAttempts` correctly decides whether this
was the last allowed try. If it was, the job is failed (and logged, since an
exhausted job is worth surfacing); otherwise it is returned to the queue with a
`RunAt` pushed out by the computed backoff. The store-mutating calls ignore their
errors deliberately — a worker cannot meaningfully recover from a failed status
write, and the loop will simply carry on.

### Recovering handler panics

```go
// runHandler invokes a handler, converting a panic into an error so one bad job
// cannot take down a worker.
func runHandler(ctx context.Context, h Handler, payload json.RawMessage) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("handler panicked: %v", r)
		}
	}()
	return h(ctx, payload)
}
```

`runHandler` is the isolation boundary around untrusted handler code. It calls the
handler inside a deferred `recover`, turning any panic into an ordinary error via
the named return value. This is what keeps one buggy handler from crashing its
worker goroutine (and, through it, the process): a panicking job looks to `run`
exactly like a job that returned an error, so it flows into the same retry-or-fail
logic instead of unwinding the stack.

### Exponential backoff

```go
// backoff returns the delay before the nth attempt's retry: base * 2^(n-1),
// capped at maxBackoff.
func (p *Pool) backoff(attempts int) time.Duration {
	d := p.baseBackoff
	for i := 1; i < attempts; i++ {
		d *= 2
		if d >= p.maxBackoff {
			return p.maxBackoff
		}
	}
	return d
}
```

`backoff` computes how long to wait before a retry, growing the delay exponentially
with the attempt number: the base delay doubled once per prior attempt, i.e.
`base * 2^(n-1)`. Spacing retries out this way keeps a persistently failing job
from hammering the store or an external dependency. The doubling is clamped at
`maxBackoff` — the function returns early the moment it reaches the cap, which also
prevents the repeated doubling from overflowing the duration.

### Cancellable sleep

```go
// sleep waits for d or until ctx is cancelled. It returns false if ctx was
// cancelled (the worker should stop).
func (p *Pool) sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
```

`sleep` is the pool's interruptible wait, used between polls of an idle or erroring
queue. Rather than blocking on `time.Sleep`, it races a timer against the context's
`Done` channel, so a shutdown does not have to wait out the full poll interval. The
boolean return is the signal the worker loop reads: `true` means the delay elapsed
normally (keep going), `false` means the context was cancelled (stop). Stopping the
timer on the way out releases its resources whichever branch wins.

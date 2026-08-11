package job

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

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

// Wait blocks until every worker has stopped (after ctx is cancelled).
func (p *Pool) Wait() { p.wg.Wait() }

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
	// A typed deterministic refusal (capacity, validation, or policy) cannot
	// succeed by waiting. Retrying it burns worker slots and obscures the one
	// actionable error an operator needs to see; transient failures keep the
	// normal bounded backoff below.
	if e, ok := limit.From(err); ok && e.Retryable != nil && !*e.Retryable {
		_ = p.store.Fail(j.ID, err.Error())
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

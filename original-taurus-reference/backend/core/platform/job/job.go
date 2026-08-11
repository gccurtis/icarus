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

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

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

// DefaultMaxAttempts is how many times a job is tried before it is marked failed,
// used when a job is enqueued without its own limit.
const DefaultMaxAttempts = 5

// MaxJobsPage bounds one observability read of the queue: however large a limit
// a caller asks for (or if it asks for none), a Store never returns more than
// this many jobs, so listing jobs can never pull the whole table.
const MaxJobsPage = 200

// ClampJobsPage applies the JobsByStatus page bound. Every Store implementation
// runs its limit through it, so the cap is defined once rather than per store.
func ClampJobsPage(limit int) int {
	if limit < 1 || limit > MaxJobsPage {
		return MaxJobsPage
	}
	return limit
}

// ErrNotFound is returned when a job id does not exist.
var ErrNotFound = errors.New("job not found")

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

// Handler runs a job's work. It receives the job's payload and returns an error
// to signal the run should be retried (or, past the attempt limit, failed).
type Handler func(ctx context.Context, payload json.RawMessage) error

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
	// JobsByStatus returns jobs with the given status, newest (most recently
	// created) first. An empty status means any status. The limit is clamped by
	// ClampJobsPage, so the read is always bounded. This is the observability
	// read: it makes a run of failures or a stuck queue visible to an operator
	// who does not already hold a job id.
	JobsByStatus(status Status, limit int) ([]Job, error)
	// JobCounts returns how many jobs are in each status. A status with no jobs
	// may be absent from the map, so a caller wanting a fixed shape fills the
	// zeros in itself.
	JobCounts() (map[Status]int, error)
	// ReapStale returns every job that has been running since before the given
	// time back to queued (due immediately), so work orphaned by a crash runs
	// again. It reports how many jobs were requeued. Attempts are preserved, so a
	// job that repeatedly kills its worker still eventually exhausts them and
	// fails rather than looping forever.
	ReapStale(before time.Time) (int, error)
}

// Enqueuer submits jobs. It is the narrow seam other packages depend on to
// schedule background work without knowing how jobs are stored or run.
type Enqueuer interface {
	Enqueue(ctx context.Context, typ string, payload any) (Job, error)
}

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

// Register binds one non-nil handler to one non-empty job type. Registration is
// startup composition, not a runtime override mechanism: duplicates fail rather
// than silently replacing the handler that was reviewed.
func (r *Registry) Register(typ string, h Handler) error {
	typ = strings.TrimSpace(typ)
	if typ == "" {
		return errors.New("job: registry type is required")
	}
	if h == nil {
		return fmt.Errorf("job: handler for %q is required", typ)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.handlers[typ]; exists {
		return fmt.Errorf("job: handler for %q is registered more than once", typ)
	}
	r.handlers[typ] = h
	return nil
}

// Handler returns the handler for a type, and whether one is registered.
func (r *Registry) Handler(typ string) (Handler, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	h, ok := r.handlers[typ]
	return h, ok
}

// Validate requires every named startup job type to have exactly one handler.
// Register already rejects duplicate keys, so this closes the other failure
// mode: a producer can never become ready while its durable work has no
// consumer.
func (r *Registry) Validate(required ...string) error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	seen := make(map[string]bool, len(required))
	missing := make([]string, 0)
	for _, typ := range required {
		typ = strings.TrimSpace(typ)
		if typ == "" {
			return errors.New("job: required registry type is blank")
		}
		if seen[typ] {
			return fmt.Errorf("job: required registry type %q is listed more than once", typ)
		}
		seen[typ] = true
		if _, ok := r.handlers[typ]; !ok {
			missing = append(missing, typ)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("job: registry is missing required handlers: %s", strings.Join(missing, ", "))
	}
	return nil
}

func newID() string {
	b := make([]byte, 16)
	// crypto/rand.Read never returns an error on the platforms we target.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

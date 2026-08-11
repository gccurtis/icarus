package job_test

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/job"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// waitFor polls until cond is true or the deadline passes, so tests do not race
// the worker pool.
func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatal("condition not met before deadline")
}

// immediateRetryStore preserves retry state transitions while removing the
// production backoff wait from tests that are not asserting timing.
type immediateRetryStore struct {
	*job.MemoryStore
}

func (s immediateRetryStore) Retry(id, lastErr string, _ time.Time) error {
	return s.MemoryStore.Retry(id, lastErr, time.Now().UTC())
}

func TestQueueEnqueueAndPoolRun(t *testing.T) {
	store := job.NewMemoryStore()
	reg := job.NewRegistry()

	var mu sync.Mutex
	var got []string
	reg.Register("greet", func(_ context.Context, payload json.RawMessage) error {
		var p struct {
			Name string `json:"name"`
		}
		_ = json.Unmarshal(payload, &p)
		mu.Lock()
		got = append(got, p.Name)
		mu.Unlock()
		return nil
	})

	queue := job.NewQueue(store, 3)
	j, err := queue.Enqueue(context.Background(), "greet", map[string]string{"name": "ada"})
	if err != nil {
		t.Fatal(err)
	}

	pool := job.NewPool(store, reg, job.Options{Workers: 2, PollInterval: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	pool.Start(ctx)
	defer func() { cancel(); pool.Wait() }()

	waitFor(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(got) == 1 && got[0] == "ada"
	})
	waitFor(t, func() bool {
		stored, _ := store.JobByID(j.ID)
		return stored.Status == job.StatusDone
	})
}

func TestRegistryRejectsDuplicateMissingAndNilHandlers(t *testing.T) {
	reg := job.NewRegistry()
	first := func(context.Context, json.RawMessage) error { return nil }
	if err := reg.Register("alpha", first); err != nil {
		t.Fatal(err)
	}
	if err := reg.Register("alpha", func(context.Context, json.RawMessage) error { return nil }); err == nil {
		t.Fatal("duplicate job registration was accepted")
	}
	if got, ok := reg.Handler("alpha"); !ok || got == nil {
		t.Fatal("duplicate registration removed the original handler")
	}
	if err := reg.Register("", first); err == nil {
		t.Fatal("blank job type was accepted")
	}
	if err := reg.Register("nil", nil); err == nil {
		t.Fatal("nil job handler was accepted")
	}
	if err := reg.Validate("alpha", "missing"); err == nil {
		t.Fatal("registry with a missing required handler validated")
	}
	if err := reg.Validate("alpha"); err != nil {
		t.Fatalf("complete registry rejected: %v", err)
	}
}

func TestPoolRetriesThenFails(t *testing.T) {
	store := immediateRetryStore{MemoryStore: job.NewMemoryStore()}
	reg := job.NewRegistry()

	var mu sync.Mutex
	attempts := 0
	reg.Register("boom", func(_ context.Context, _ json.RawMessage) error {
		mu.Lock()
		attempts++
		mu.Unlock()
		return errors.New("nope")
	})

	queue := job.NewQueue(store, 2) // one initial try + one retry, then failed
	j, _ := queue.Enqueue(context.Background(), "boom", nil)

	pool := job.NewPool(store, reg, job.Options{Workers: 1, PollInterval: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	pool.Start(ctx)
	defer func() { cancel(); pool.Wait() }()

	waitFor(t, func() bool {
		stored, _ := store.JobByID(j.ID)
		return stored.Status == job.StatusFailed
	})
	mu.Lock()
	defer mu.Unlock()
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2 (initial + one retry)", attempts)
	}
}

func TestPoolDoesNotRetryANonRetryableTypedLimit(t *testing.T) {
	store := job.NewMemoryStore()
	reg := job.NewRegistry()
	retryable := false
	var mu sync.Mutex
	attempts := 0
	reg.Register("capacity", func(_ context.Context, _ json.RawMessage) error {
		mu.Lock()
		attempts++
		mu.Unlock()
		return &limit.Exceeded{Code: "knowledge.project_artifact_limit", Message: "capacity", Retryable: &retryable}
	})

	queue := job.NewQueue(store, 5)
	j, err := queue.Enqueue(context.Background(), "capacity", nil)
	if err != nil {
		t.Fatal(err)
	}
	pool := job.NewPool(store, reg, job.Options{Workers: 1, PollInterval: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	pool.Start(ctx)
	defer func() { cancel(); pool.Wait() }()

	waitFor(t, func() bool {
		stored, _ := store.JobByID(j.ID)
		return stored.Status == job.StatusFailed
	})
	mu.Lock()
	defer mu.Unlock()
	if attempts != 1 {
		t.Fatalf("attempts = %d, want one deterministic refusal", attempts)
	}
}

func TestPoolUnknownTypeFails(t *testing.T) {
	store := job.NewMemoryStore()
	reg := job.NewRegistry()
	queue := job.NewQueue(store, 3)
	j, _ := queue.Enqueue(context.Background(), "no-handler", nil)

	pool := job.NewPool(store, reg, job.Options{Workers: 1, PollInterval: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	pool.Start(ctx)
	defer func() { cancel(); pool.Wait() }()

	waitFor(t, func() bool {
		stored, _ := store.JobByID(j.ID)
		return stored.Status == job.StatusFailed
	})
}

// TestReapStaleRequeuesOrphanedRunningJobs pins BUG-2 at the store level: a job
// left running (its worker died) must be returned to queued, preserving its
// attempt count; a job still legitimately running (recently touched) must not.
func TestReapStaleRequeuesOrphanedRunningJobs(t *testing.T) {
	store := job.NewMemoryStore()
	base := time.Now().UTC()
	if _, err := store.Enqueue(job.Job{
		ID: "orphan", Type: "x", Status: job.StatusRunning, Attempts: 1, MaxAttempts: 3,
		RunAt: base.Add(-time.Hour), CreatedAt: base.Add(-time.Hour), UpdatedAt: base.Add(-time.Hour),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Enqueue(job.Job{
		ID: "live", Type: "x", Status: job.StatusRunning, Attempts: 1, MaxAttempts: 3,
		RunAt: base, CreatedAt: base, UpdatedAt: base,
	}); err != nil {
		t.Fatal(err)
	}
	n, err := store.ReapStale(base.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("reaped %d, want 1", n)
	}
	if got, _ := store.JobByID("orphan"); got.Status != job.StatusQueued || got.Attempts != 1 {
		t.Fatalf("orphan after reap = %+v, want queued with attempts preserved", got)
	}
	if got, _ := store.JobByID("live"); got.Status != job.StatusRunning {
		t.Fatalf("live job requeued unexpectedly = %+v", got)
	}
}

// TestJobsByStatusAndCounts pins the observability read (JOB-1): a failed run is
// visible without already holding a job id. JobsByStatus filters by status,
// returns the newest first, and honours the limit; JobCounts summarises the
// whole table so a stuck queue shows up as a count.
func TestJobsByStatusAndCounts(t *testing.T) {
	store := job.NewMemoryStore()
	base := time.Now().UTC()
	seed := []job.Job{
		{ID: "f1", Type: "x", Status: job.StatusFailed, CreatedAt: base.Add(-3 * time.Hour)},
		{ID: "f2", Type: "x", Status: job.StatusFailed, CreatedAt: base.Add(-2 * time.Hour)},
		{ID: "f3", Type: "x", Status: job.StatusFailed, CreatedAt: base.Add(-1 * time.Hour)},
		{ID: "q1", Type: "x", Status: job.StatusQueued, CreatedAt: base},
		{ID: "d1", Type: "x", Status: job.StatusDone, CreatedAt: base},
	}
	for _, j := range seed {
		if _, err := store.Enqueue(j); err != nil {
			t.Fatal(err)
		}
	}

	failed, err := store.JobsByStatus(job.StatusFailed, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(failed) != 3 || failed[0].ID != "f3" || failed[2].ID != "f1" {
		t.Fatalf("failed jobs = %+v, want f3, f2, f1 (newest first)", failed)
	}

	// The limit bounds the read, keeping the newest.
	capped, err := store.JobsByStatus(job.StatusFailed, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(capped) != 2 || capped[0].ID != "f3" || capped[1].ID != "f2" {
		t.Fatalf("limited failed jobs = %+v, want f3, f2", capped)
	}

	// An empty status means "any status", still bounded.
	all, err := store.JobsByStatus("", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != len(seed) {
		t.Fatalf("all jobs = %d, want %d", len(all), len(seed))
	}

	counts, err := store.JobCounts()
	if err != nil {
		t.Fatal(err)
	}
	if counts[job.StatusFailed] != 3 || counts[job.StatusQueued] != 1 || counts[job.StatusDone] != 1 {
		t.Fatalf("counts = %+v, want failed=3 queued=1 done=1", counts)
	}
	if counts[job.StatusRunning] != 0 {
		t.Errorf("counts[running] = %d, want 0", counts[job.StatusRunning])
	}
}

// TestJobsByStatusIsBounded proves the store never hands back more than its own
// page cap, whatever limit the caller asks for (including a non-positive one).
func TestJobsByStatusIsBounded(t *testing.T) {
	store := job.NewMemoryStore()
	now := time.Now().UTC()
	for i := 0; i < job.MaxJobsPage+5; i++ {
		if _, err := store.Enqueue(job.Job{
			ID: "j" + strconv.Itoa(i), Type: "x",
			Status: job.StatusQueued, CreatedAt: now.Add(time.Duration(i) * time.Second),
		}); err != nil {
			t.Fatal(err)
		}
	}
	for _, limit := range []int{0, -1, job.MaxJobsPage * 10} {
		got, err := store.JobsByStatus("", limit)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != job.MaxJobsPage {
			t.Errorf("limit %d returned %d jobs, want the %d cap", limit, len(got), job.MaxJobsPage)
		}
	}
}

// TestPoolRequeuesOrphanedJobOnStart pins BUG-2 end to end: a job stuck running
// from a previous (crashed) process must be recovered and run when the pool starts.
func TestPoolRequeuesOrphanedJobOnStart(t *testing.T) {
	store := job.NewMemoryStore()
	reg := job.NewRegistry()
	done := make(chan struct{}, 1)
	reg.Register("resume", func(context.Context, json.RawMessage) error {
		select {
		case done <- struct{}{}:
		default:
		}
		return nil
	})
	past := time.Now().UTC().Add(-time.Hour)
	if _, err := store.Enqueue(job.Job{
		ID: "stuck", Type: "resume", Status: job.StatusRunning, Attempts: 1, MaxAttempts: 3,
		RunAt: past, CreatedAt: past, UpdatedAt: past,
	}); err != nil {
		t.Fatal(err)
	}

	pool := job.NewPool(store, reg, job.Options{Workers: 1, PollInterval: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	pool.Start(ctx)
	defer func() { cancel(); pool.Wait() }()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("orphaned job was not recovered and run at startup")
	}
	waitFor(t, func() bool {
		got, _ := store.JobByID("stuck")
		return got.Status == job.StatusDone
	})
}

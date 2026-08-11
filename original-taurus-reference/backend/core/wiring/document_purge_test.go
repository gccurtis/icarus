package wiring

import (
	"context"
	"sync"
	"testing"
	"time"
)

type countingPurger struct {
	mu    sync.Mutex
	calls int
}

func (p *countingPurger) PurgeStale() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls++
	return nil
}

func (p *countingPurger) count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls
}

// TestTrashPurgeSweepsPeriodicallyAndStops pins PERF-3. Purging stale trash used
// to run once, synchronously, on the boot path: it delayed readiness, and a
// long-lived process never purged again no matter how much trash accumulated.
// It must now sweep on an interval and stop with its context.
func TestTrashPurgeSweepsPeriodicallyAndStops(t *testing.T) {
	p := &countingPurger{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { runTrashPurge(ctx, p, time.Millisecond); close(done) }()

	deadline := time.Now().Add(2 * time.Second)
	for p.count() < 2 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if p.count() < 2 {
		t.Fatalf("purger ran %d times, want repeated sweeps", p.count())
	}

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("purge loop did not stop when its context was cancelled")
	}
	settled := p.count()
	time.Sleep(20 * time.Millisecond)
	if p.count() != settled {
		t.Fatalf("purger kept running after cancellation (%d → %d)", settled, p.count())
	}
}

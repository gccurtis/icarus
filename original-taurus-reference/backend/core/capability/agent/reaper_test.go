package agent

import (
	"context"
	"testing"
	"time"
)

// reaperSpyStore counts ReapStaleTasks calls so a test can observe the reaper
// goroutine's activity.
type reaperSpyStore struct {
	TaskStore
	reaped chan struct{}
}

func (s reaperSpyStore) ReapStaleTasks(before time.Time) error {
	select {
	case s.reaped <- struct{}{}:
	default:
	}
	return s.TaskStore.ReapStaleTasks(before)
}

// TestStartReaperStopsWhenContextCancelled pins BUG-3: the task reaper must be
// bound to a context so it stops on shutdown instead of looping forever (and
// touching the store as it closes).
func TestStartReaperStopsWhenContextCancelled(t *testing.T) {
	spy := reaperSpyStore{TaskStore: NewMemoryTaskStore(), reaped: make(chan struct{}, 128)}
	tasks, err := NewTasks(spy, TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	tasks.StartReaper(ctx, time.Millisecond, time.Minute)

	// The reaper ticks while the context is live.
	select {
	case <-spy.reaped:
	case <-time.After(time.Second):
		t.Fatal("reaper never ran")
	}

	// After cancellation it must stop: drain in-flight ticks, then require silence.
	cancel()
	time.Sleep(20 * time.Millisecond)
	for len(spy.reaped) > 0 {
		<-spy.reaped
	}
	select {
	case <-spy.reaped:
		t.Fatal("reaper kept running after its context was cancelled")
	case <-time.After(50 * time.Millisecond):
	}
}

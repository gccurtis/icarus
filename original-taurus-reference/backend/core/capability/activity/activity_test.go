package activity_test

import (
	"errors"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/activity"
)

func TestListPagesByTimeThenID(t *testing.T) {
	now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
	store := activity.NewMemoryStore(
		activity.Event{ID: "b", ProjectID: "p1", OccurredAt: now},
		activity.Event{ID: "a", ProjectID: "p1", OccurredAt: now},
		activity.Event{ID: "z", ProjectID: "p2", OccurredAt: now.Add(time.Hour)},
		activity.Event{ID: "c", ProjectID: "p1", OccurredAt: now.Add(-time.Hour)},
	)
	svc := activity.New(store)
	first, err := svc.List("p1", activity.PageRequest{Limit: 2})
	if err != nil || len(first.Events) != 2 || first.Events[0].ID != "b" || first.Events[1].ID != "a" || first.NextCursor == "" {
		t.Fatalf("first page = %+v, %v", first, err)
	}
	second, err := svc.List("p1", activity.PageRequest{Limit: 2, Cursor: first.NextCursor})
	if err != nil || len(second.Events) != 1 || second.Events[0].ID != "c" || second.NextCursor != "" {
		t.Fatalf("second page = %+v, %v", second, err)
	}
}

func TestListRejectsInvalidInput(t *testing.T) {
	svc := activity.New(activity.NewMemoryStore())
	if _, err := svc.List("p", activity.PageRequest{Limit: activity.MaxLimit + 1}); !errors.Is(err, activity.ErrInvalidLimit) {
		t.Fatalf("limit err = %v", err)
	}
	if _, err := svc.List("p", activity.PageRequest{Cursor: "not-a-cursor"}); !errors.Is(err, activity.ErrInvalidCursor) {
		t.Fatalf("cursor err = %v", err)
	}
}

func TestLatestByProjects(t *testing.T) {
	now := time.Now().UTC()
	svc := activity.New(activity.NewMemoryStore(
		activity.Event{ID: "1", ProjectID: "p1", OccurredAt: now.Add(-time.Hour)},
		activity.Event{ID: "2", ProjectID: "p1", OccurredAt: now},
		activity.Event{ID: "3", ProjectID: "p2", OccurredAt: now.Add(time.Hour)},
	))
	got, err := svc.LatestByProjects([]string{"p1", "missing"})
	if err != nil || !got["p1"].Equal(now) {
		t.Fatalf("latest = %+v, %v", got, err)
	}
	if _, ok := got["p2"]; ok {
		t.Fatal("returned an unrequested project")
	}
}

func TestListFiltersByTargetID(t *testing.T) {
	now := time.Now().UTC()
	store := activity.NewMemoryStore(
		activity.Event{ID: "e1", ProjectID: "p1", Target: activity.ResourceSnapshot{ID: "doc-1"}, OccurredAt: now},
		activity.Event{ID: "e2", ProjectID: "p1", Target: activity.ResourceSnapshot{ID: "doc-2"}, OccurredAt: now.Add(-time.Minute)},
		activity.Event{ID: "e3", ProjectID: "p1", Target: activity.ResourceSnapshot{ID: "doc-1"}, OccurredAt: now.Add(-2 * time.Minute)},
	)
	svc := activity.New(store)

	// No targetID → all three project events.
	all, err := svc.List("p1", activity.PageRequest{})
	if err != nil || len(all.Events) != 3 {
		t.Fatalf("unfiltered = %d events, %v; want 3", len(all.Events), err)
	}

	// targetID doc-1 → only its two events.
	filtered, err := svc.List("p1", activity.PageRequest{TargetID: "doc-1"})
	if err != nil {
		t.Fatalf("filtered: %v", err)
	}
	if len(filtered.Events) != 2 {
		t.Fatalf("targetID doc-1 = %d events, want 2", len(filtered.Events))
	}
	for _, e := range filtered.Events {
		if e.Target.ID != "doc-1" {
			t.Errorf("leaked event for target %q", e.Target.ID)
		}
	}
}

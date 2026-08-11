package presence

import (
	"testing"
	"time"
)

// clockedPresence returns a tracker whose clock the test controls.
func clockedPresence(ttl time.Duration, clock *time.Time) *Presence {
	p := New(ttl)
	p.now = func() time.Time { return *clock }
	return p
}

func TestTouchClearAndTTL(t *testing.T) {
	now := time.Unix(1000, 0)
	p := clockedPresence(30*time.Second, &now)

	p.Touch("doc-1", "u1", "Ann", "owner")
	p.Touch("doc-1", "u2", "Bo", "edit")
	if open := p.Open("doc-1"); len(open) != 2 {
		t.Fatalf("open = %d, want 2", len(open))
	}

	// Clear removes one; the other remains.
	p.Clear("doc-1", "u1")
	open := p.Open("doc-1")
	if len(open) != 1 || open[0].UserID != "u2" || open[0].Access != "edit" {
		t.Fatalf("after clear: %+v", open)
	}

	// Past the TTL with no heartbeat, the entry expires.
	now = now.Add(31 * time.Second)
	if open := p.Open("doc-1"); len(open) != 0 {
		t.Fatalf("after TTL: %+v, want empty", open)
	}
}

func TestPresenceIsPerDocument(t *testing.T) {
	now := time.Unix(1, 0)
	p := clockedPresence(30*time.Second, &now)
	p.Touch("doc-1", "u1", "Ann", "owner")
	if open := p.Open("doc-2"); len(open) != 0 {
		t.Fatalf("doc-2 = %+v, want empty", open)
	}
}

func TestOpenNewestFirst(t *testing.T) {
	now := time.Unix(1, 0)
	p := clockedPresence(time.Hour, &now)
	p.Touch("doc-1", "u1", "Ann", "owner")
	now = now.Add(time.Second)
	p.Touch("doc-1", "u2", "Bo", "read")
	open := p.Open("doc-1")
	if len(open) != 2 || open[0].UserID != "u2" {
		t.Fatalf("newest-first wrong: %+v", open)
	}
}

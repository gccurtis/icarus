package notification

import "testing"

func TestPushThenDrainReturnsToastOnce(t *testing.T) {
	n := New()
	n.Push("user-1", Toast{Level: LevelSuccess, Title: "Task done", Body: "ok", ProjectID: "proj-1"})

	first := n.Drain("proj-1", "user-1")
	if len(first) != 1 {
		t.Fatalf("expected 1 toast, got %d", len(first))
	}
	if first[0].Title != "Task done" || first[0].Level != LevelSuccess || first[0].ProjectID != "proj-1" {
		t.Fatalf("unexpected toast: %+v", first[0])
	}
	if first[0].ID == "" || first[0].CreatedAt.IsZero() {
		t.Fatalf("Push must assign ID and CreatedAt: %+v", first[0])
	}

	second := n.Drain("proj-1", "user-1")
	if len(second) != 0 {
		t.Fatalf("drain is destructive; expected 0 on second drain, got %d", len(second))
	}
}

func TestDrainIsPerUser(t *testing.T) {
	n := New()
	n.Push("user-1", Toast{Level: LevelInfo, Title: "for one", ProjectID: "proj-1"})

	if got := n.Drain("proj-1", "user-2"); len(got) != 0 {
		t.Fatalf("another user must not see the toast, got %d", len(got))
	}
	if got := n.Drain("proj-1", "user-1"); len(got) != 1 {
		t.Fatalf("owner should still have the toast, got %d", len(got))
	}
}

func TestDrainIsProjectScoped(t *testing.T) {
	n := New()
	n.Push("user-1", Toast{Level: LevelInfo, Title: "in A", ProjectID: "proj-a"})
	n.Push("user-1", Toast{Level: LevelInfo, Title: "in B", ProjectID: "proj-b"})

	a := n.Drain("proj-a", "user-1")
	if len(a) != 1 || a[0].Title != "in A" {
		t.Fatalf("expected only project A toast, got %+v", a)
	}
	b := n.Drain("proj-b", "user-1")
	if len(b) != 1 || b[0].Title != "in B" {
		t.Fatalf("expected only project B toast, got %+v", b)
	}
}

func TestPushIgnoresEmptyUser(t *testing.T) {
	n := New()
	n.Push("", Toast{Level: LevelInfo, Title: "nobody", ProjectID: "proj-1"})
	if got := n.Drain("proj-1", ""); len(got) != 0 {
		t.Fatalf("empty user must not accumulate toasts, got %d", len(got))
	}
}

func TestQueueIsBoundedDroppingOldest(t *testing.T) {
	n := New()
	for i := 0; i < maxPerUser+10; i++ {
		n.Push("user-1", Toast{Level: LevelInfo, Title: title(i), ProjectID: "proj-1"})
	}
	got := n.Drain("proj-1", "user-1")
	if len(got) != maxPerUser {
		t.Fatalf("queue must be bounded to %d, got %d", maxPerUser, len(got))
	}
	// The oldest 10 were dropped; the first surviving toast is #10.
	if got[0].Title != title(10) {
		t.Fatalf("expected oldest surviving toast %q, got %q", title(10), got[0].Title)
	}
	if got[len(got)-1].Title != title(maxPerUser+9) {
		t.Fatalf("expected newest toast %q, got %q", title(maxPerUser+9), got[len(got)-1].Title)
	}
}

func TestPushDefaultsUnknownLevelToInfo(t *testing.T) {
	n := New()
	n.Push("user-1", Toast{Level: Level("shouty"), Title: "x", ProjectID: "proj-1"})
	got := n.Drain("proj-1", "user-1")
	if len(got) != 1 || got[0].Level != LevelInfo {
		t.Fatalf("unknown level should default to info, got %+v", got)
	}
}

func title(i int) string {
	return "toast-" + itoa(i)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}

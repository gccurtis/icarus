package comment

import (
	"errors"
	"testing"
)

// fakeAnchors is a stand-in AnchorReader: it knows which (doc, anchor) pairs
// exist, which anchors are orphaned, and counts inline creations.
type fakeAnchors struct {
	valid    map[string]bool
	orphaned map[string]bool
	created  int
}

func newFakeAnchors() *fakeAnchors {
	return &fakeAnchors{valid: map[string]bool{}, orphaned: map[string]bool{}}
}

func (f *fakeAnchors) AnchorInProject(_, documentID, anchorID string) (AnchorInfo, error) {
	if !f.valid[documentID+"/"+anchorID] {
		return AnchorInfo{}, ErrAnchorNotFound
	}
	return AnchorInfo{ID: anchorID, Orphaned: f.orphaned[anchorID]}, nil
}

func (f *fakeAnchors) CreateAnchor(_, documentID string, _ AnchorRef) (AnchorInfo, error) {
	f.created++
	id := "inline-1"
	f.valid[documentID+"/"+id] = true
	return AnchorInfo{ID: id}, nil
}

func newComments(t *testing.T, anchors AnchorReader) *Comments {
	t.Helper()
	c, err := New(NewMemoryStore(), anchors)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return c
}

func TestCreateAgainstExistingAnchor(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/anchorA"] = true
	c := newComments(t, anchors)

	got, err := c.Create(Scope{ProjectID: "p1"}, "doc1", "u1", "Ann", "needs a citation", AnchorSelector{AnchorID: "anchorA"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.AnchorID != "anchorA" || got.Body != "needs a citation" || got.Resolved {
		t.Errorf("unexpected comment: %+v", got)
	}
	if got.AuthorName != "Ann" || got.Replies == nil {
		t.Errorf("author/replies not initialized: %+v", got)
	}
}

func TestCreateWithInlineAnchor(t *testing.T) {
	anchors := newFakeAnchors()
	c := newComments(t, anchors)

	got, err := c.Create(Scope{ProjectID: "p1"}, "doc1", "u1", "", "inline note",
		AnchorSelector{Inline: &AnchorRef{RowID: "r1", BlockID: "b1", AtomID: "a1", Start: 0, End: 4}})
	if err != nil {
		t.Fatalf("Create inline: %v", err)
	}
	if anchors.created != 1 {
		t.Errorf("expected one inline anchor creation, got %d", anchors.created)
	}
	if got.AnchorID != "inline-1" || got.AuthorName != "u1" { // name falls back to id
		t.Errorf("unexpected comment: %+v", got)
	}
}

func TestCreateWithoutAnchorFails(t *testing.T) {
	c := newComments(t, newFakeAnchors())
	if _, err := c.Create(Scope{ProjectID: "p1"}, "doc1", "u1", "Ann", "hi", AnchorSelector{}); !errors.Is(err, ErrAnchorMissing) {
		t.Errorf("want ErrAnchorMissing, got %v", err)
	}
}

func TestListResolvedFilter(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	c := newComments(t, anchors)
	scope := Scope{ProjectID: "p1"}

	open, _ := c.Create(scope, "doc1", "u1", "Ann", "open one", AnchorSelector{AnchorID: "a"})
	done, _ := c.Create(scope, "doc1", "u1", "Ann", "done one", AnchorSelector{AnchorID: "a"})
	if _, err := c.Patch(scope, done.ID, nil, boolPtr(true)); err != nil {
		t.Fatalf("Patch resolve: %v", err)
	}

	all, _ := c.List(scope, "doc1", nil)
	if len(all) != 2 {
		t.Fatalf("want 2 comments, got %d", len(all))
	}
	openOnly, _ := c.List(scope, "doc1", boolPtr(false))
	if len(openOnly) != 1 || openOnly[0].ID != open.ID {
		t.Errorf("open filter wrong: %+v", openOnly)
	}
	resolvedOnly, _ := c.List(scope, "doc1", boolPtr(true))
	if len(resolvedOnly) != 1 || resolvedOnly[0].ID != done.ID || !resolvedOnly[0].Resolved {
		t.Errorf("resolved filter wrong: %+v", resolvedOnly)
	}
}

func TestReplyThreadingAndDeleteCascade(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	c := newComments(t, anchors)
	scope := Scope{ProjectID: "p1"}

	root, _ := c.Create(scope, "doc1", "u1", "Ann", "root", AnchorSelector{AnchorID: "a"})
	if _, err := c.Reply(scope, root.ID, "u2", "Bob", "first"); err != nil {
		t.Fatalf("Reply: %v", err)
	}
	if _, err := c.Reply(scope, root.ID, "u1", "Ann", "second"); err != nil {
		t.Fatalf("Reply: %v", err)
	}
	got, _ := c.Get(scope, root.ID)
	if len(got.Replies) != 2 || got.Replies[0].Body != "first" || got.Replies[1].Body != "second" {
		t.Fatalf("reply thread wrong: %+v", got.Replies)
	}

	if err := c.Delete(scope, root.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := c.Get(scope, root.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("comment should be gone, got %v", err)
	}
	// Replies must be gone too (cascade), not resurrectable under a new comment.
	store := c.store.(*MemoryStore)
	if got := store.replies[root.ID]; len(got) != 0 {
		t.Errorf("replies should cascade-delete, got %+v", got)
	}
}

// countingReplies wraps MemoryStore to count how many reply loads a call makes,
// per method.
type countingReplies struct {
	*MemoryStore
	single int
	batch  int
}

func (c *countingReplies) RepliesByComment(id string) ([]Reply, error) {
	c.single++
	return c.MemoryStore.RepliesByComment(id)
}

func (c *countingReplies) RepliesByComments(ids []string) (map[string][]Reply, error) {
	c.batch++
	return c.MemoryStore.RepliesByComments(ids)
}

// TestListBatchesReplyLoads pins PERF-2: listing a document's comments must load
// every thread in one batched call, not one query per comment (N+1), and the
// batched result must match what per-comment hydration produces.
func TestListBatchesReplyLoads(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	store := &countingReplies{MemoryStore: NewMemoryStore()}
	c, err := New(store, anchors)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	scope := Scope{ProjectID: "p1"}

	want := map[string][]string{}
	var ids []string
	for i, bodies := range [][]string{{"a1", "a2"}, nil, {"c1"}, {"d1", "d2", "d3"}} {
		made, err := c.Create(scope, "doc1", "u1", "Ann", string(rune('A'+i)), AnchorSelector{AnchorID: "a"})
		if err != nil {
			t.Fatalf("Create: %v", err)
		}
		ids = append(ids, made.ID)
		for _, body := range bodies {
			if _, err := c.Reply(scope, made.ID, "u2", "Bob", body); err != nil {
				t.Fatalf("Reply: %v", err)
			}
			want[made.ID] = append(want[made.ID], body)
		}
	}
	// A comment on another document must not ride along in the batch.
	anchors.valid["doc2/a"] = true
	other, _ := c.Create(scope, "doc2", "u1", "Ann", "elsewhere", AnchorSelector{AnchorID: "a"})
	if _, err := c.Reply(scope, other.ID, "u2", "Bob", "not mine"); err != nil {
		t.Fatalf("Reply: %v", err)
	}

	store.single, store.batch = 0, 0
	list, err := c.List(scope, "doc1", nil)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != len(ids) {
		t.Fatalf("List returned %d comments, want %d", len(list), len(ids))
	}
	if store.single != 0 || store.batch != 1 {
		t.Errorf("List made %d per-comment and %d batched reply loads; want 0 and 1", store.single, store.batch)
	}
	for _, got := range list {
		var bodies []string
		for _, r := range got.Replies {
			bodies = append(bodies, r.Body)
		}
		if len(bodies) != len(want[got.ID]) {
			t.Fatalf("comment %s: %d replies, want %d", got.ID, len(bodies), len(want[got.ID]))
		}
		for i, body := range bodies {
			if body != want[got.ID][i] {
				t.Errorf("comment %s reply %d = %q, want %q", got.ID, i, body, want[got.ID][i])
			}
		}
		if got.Replies == nil {
			t.Errorf("comment %s: replies must be an empty slice, not nil", got.ID)
		}
		// The batched path must agree with per-comment hydration.
		one, err := c.Get(scope, got.ID)
		if err != nil {
			t.Fatalf("Get: %v", err)
		}
		if len(one.Replies) != len(got.Replies) || one.AnchorOrphaned != got.AnchorOrphaned {
			t.Errorf("comment %s: batched %+v != per-comment %+v", got.ID, got, one)
		}
	}
}

func TestCrossProjectIsolation(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	c := newComments(t, anchors)

	mine, _ := c.Create(Scope{ProjectID: "p1"}, "doc1", "u1", "Ann", "mine", AnchorSelector{AnchorID: "a"})
	// Another project cannot read, patch, reply to, or delete it.
	other := Scope{ProjectID: "p2"}
	if _, err := c.Get(other, mine.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get cross-project: want ErrNotFound, got %v", err)
	}
	if _, err := c.Patch(other, mine.ID, strPtr("x"), nil); !errors.Is(err, ErrNotFound) {
		t.Errorf("Patch cross-project: want ErrNotFound, got %v", err)
	}
	if _, err := c.Reply(other, mine.ID, "u9", "X", "hi"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Reply cross-project: want ErrNotFound, got %v", err)
	}
	if err := c.Delete(other, mine.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Delete cross-project: want ErrNotFound, got %v", err)
	}
}

func TestOrphanedAnchorFlag(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	c := newComments(t, anchors)
	scope := Scope{ProjectID: "p1"}

	made, _ := c.Create(scope, "doc1", "u1", "Ann", "note", AnchorSelector{AnchorID: "a"})
	if got, _ := c.Get(scope, made.ID); got.AnchorOrphaned {
		t.Errorf("anchor should be valid, got orphaned")
	}
	// The document's edit orphaned the anchor target.
	anchors.orphaned["a"] = true
	if got, _ := c.Get(scope, made.ID); !got.AnchorOrphaned {
		t.Errorf("anchor should now read orphaned")
	}
}

func TestScopeRequired(t *testing.T) {
	c := newComments(t, newFakeAnchors())
	if _, err := c.Create(Scope{}, "doc1", "u1", "Ann", "hi", AnchorSelector{AnchorID: "a"}); !errors.Is(err, ErrInvalidScope) {
		t.Errorf("Create: want ErrInvalidScope, got %v", err)
	}
	if _, err := c.List(Scope{}, "doc1", nil); !errors.Is(err, ErrInvalidScope) {
		t.Errorf("List: want ErrInvalidScope, got %v", err)
	}
}

// failingReplies wraps MemoryStore to inject a reply-load failure, simulating a
// transient DB error.
type failingReplies struct {
	*MemoryStore
	fail bool
}

func (f *failingReplies) RepliesByComment(id string) ([]Reply, error) {
	if f.fail {
		return nil, errors.New("db down")
	}
	return f.MemoryStore.RepliesByComment(id)
}

func (f *failingReplies) RepliesByComments(ids []string) (map[string][]Reply, error) {
	if f.fail {
		return nil, errors.New("db down")
	}
	return f.MemoryStore.RepliesByComments(ids)
}

// TestHydratePropagatesStoreError is a regression test: an infrastructure error
// while loading replies must surface as an error, not a silently empty thread.
func TestHydratePropagatesStoreError(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/a"] = true
	store := &failingReplies{MemoryStore: NewMemoryStore()}
	c, err := New(store, anchors)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	scope := Scope{ProjectID: "p1"}
	made, _ := c.Create(scope, "doc1", "u1", "Ann", "note", AnchorSelector{AnchorID: "a"})

	store.fail = true
	if _, err := c.Get(scope, made.ID); err == nil {
		t.Errorf("Get must propagate a reply-store error, not return an empty thread")
	}
	if _, err := c.List(scope, "doc1", nil); err == nil {
		t.Errorf("List must propagate a reply-store error")
	}
}

func boolPtr(b bool) *bool    { return &b }
func strPtr(s string) *string { return &s }

// TestStoreCommentReadsAreProjectScoped pins DEF-1 at the comment port: the
// store's by-id read carries the project label itself, so a foreign project is
// refused by the store rather than only by load's ProjectID comparison. That
// comparison stays in place — two independent layers, neither load-bearing
// alone.
func TestStoreCommentReadsAreProjectScoped(t *testing.T) {
	anchors := newFakeAnchors()
	anchors.valid["doc1/anchorA"] = true
	store := NewMemoryStore()
	c, err := New(store, anchors)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	made, err := c.Create(Scope{ProjectID: "p1"}, "doc1", "u1", "Ann", "needs a citation", AnchorSelector{AnchorID: "anchorA"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if got, err := store.CommentByID("p1", made.ID); err != nil || got.Body != "needs a citation" {
		t.Fatalf("owning-project CommentByID = %+v, %v", got, err)
	}
	if got, err := store.CommentByID("p2", made.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("foreign-project CommentByID = %+v, %v; want ErrNotFound", got, err)
	}
}

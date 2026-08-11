package knowledge_test

import (
	"context"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// windowIDs is the set of window ids currently stored for a project.
func windowIDs(t *testing.T, store *knowledge.MemoryStore, projectID string) map[string]bool {
	t.Helper()
	windows, err := store.ProjectWindows(projectID)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]bool{}
	for _, w := range windows {
		out[w.ID] = true
	}
	return out
}

// Appending to a document must not change the identity of the windows that did
// not change. This is the precondition for anything incremental: before it, a
// one-character edit replaced every artifact id in the source, so nothing
// downstream could tell what had actually moved.
func TestUnchangedWindowsKeepTheirIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	body := strings.Repeat("alpha beta gamma delta epsilon zeta. ", 20)
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", body, nil, 0); err != nil {
		t.Fatal(err)
	}
	before := windowIDs(t, store, "p")

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "",
		body+"omega psi chi tau sigma a genuinely new tail sentence. ", nil, 0); err != nil {
		t.Fatal(err)
	}
	after := windowIDs(t, store, "p")

	kept := 0
	for id := range before {
		if _, ok := after[id]; ok {
			kept++
		}
	}
	if kept == 0 {
		t.Fatal("an append replaced every window id; nothing incremental can work on this")
	}
	// Most of the document is untouched, so most ids must survive.
	if kept < len(before)/2 {
		t.Errorf("only %d of %d window ids survived an append", kept, len(before))
	}
}

// Two windows with byte-identical text must still be two windows. Reusing ids by
// text alone would collapse them onto one id — a primary key collision, and a
// silently lost window.
func TestDuplicateWindowTextKeepsDistinctIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	// The same sentence block repeated produces windows with identical text.
	para := strings.Repeat("identical sentence here. ", 8)
	text := para + para + para
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	windows, err := store.ProjectWindows("p")
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, w := range windows {
		if seen[w.ID] {
			t.Fatalf("duplicate window id %s — a window was lost to a key collision", w.ID)
		}
		seen[w.ID] = true
	}

	// Re-adding the same text must be a no-op, not a collision.
	res, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Skipped {
		t.Errorf("identical re-add did not skip: %+v", res)
	}

	// And a re-add with MORE copies keeps every id distinct: three prior windows
	// with the same text can serve at most three, so the extra gets a fresh id.
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", text+para, nil, 0); err != nil {
		t.Fatal(err)
	}
	windows, err = store.ProjectWindows("p")
	if err != nil {
		t.Fatal(err)
	}
	seen = map[string]bool{}
	for _, w := range windows {
		if seen[w.ID] {
			t.Fatalf("duplicate window id %s after growing a repeated block", w.ID)
		}
		seen[w.ID] = true
	}
}

// Appending to a source must leave the node ids of the clusters it did not
// touch alone. A node is its member set, so a clique of unchanged windows is the
// same clique — and now has the same id. Before content-addressing every node in
// the source was re-minted regardless.
func TestUnchangedClustersKeepTheirNodeIDs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	body := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta. ", 40)
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "", body, nil, 0); err != nil {
		t.Fatal(err)
	}
	before := sourceNodeIDs(t, store, "p")
	if len(before) == 0 {
		t.Fatal("no source-tier nodes formed; the test proves nothing")
	}

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "",
		body+"omega psi chi a genuinely different tail. ", nil, 0); err != nil {
		t.Fatal(err)
	}
	after := sourceNodeIDs(t, store, "p")

	shared := 0
	for id := range before {
		if after[id] {
			shared++
		}
	}
	if shared == 0 {
		t.Errorf("an append re-minted every node id (%d before, %d after) — clusters of unchanged windows must keep their identity",
			len(before), len(after))
	}
}

// sourceNodeIDs collects the ids of every source-tier node in the project, by
// walking down from the entry frontier.
func sourceNodeIDs(t *testing.T, store *knowledge.MemoryStore, projectID string) map[string]bool {
	t.Helper()
	nodes, _ := loadLattice(t, store, projectID)
	out := map[string]bool{}
	for _, n := range nodes {
		if n.LocalRefID != "" {
			out[n.ID] = true
		}
	}
	return out
}

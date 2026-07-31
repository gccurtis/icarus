package knowledge_test

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// A batch large enough to slice several ways. Each item is distinct so a
// misrouted vector or a dropped slice is visible, and long enough to window more
// than once under smallWindows.
func slicingItems(n int) []knowledge.AddItem {
	items := make([]knowledge.AddItem, n)
	for i := range items {
		var sb strings.Builder
		for j := 0; j < 6; j++ {
			fmt.Fprintf(&sb, "Source %d paragraph %d about topic %d and its details. ", i, j, i)
		}
		items[i] = knowledge.AddItem{
			SourceType: knowledge.SourceTypeDocument,
			SourceID:   fmt.Sprintf("doc%d", i),
			Content:    knowledge.TextContent(sb.String()),
		}
	}
	return items
}

// latticeShape describes what a project's lattice *is*, without reference to any
// minted id.
//
// Ids cannot appear here. A window id is 16 random bytes and a node id is
// content-addressed from its members' ids, so two ingests of identical content
// into two databases agree on everything except their identifiers. Comparing
// texts, ranges and structural counts compares the part that carries meaning.
type latticeShape struct {
	windows  []string // "sourceID|start-end|text", sorted
	forests  []string // "sourceID|windows|nodes", one per item in item order
	frontier int      // corpus-tier entry count: source roots plus orphan windows
}

// ingest runs one batch under a given commit budget and returns the resulting
// shape plus how many store writes it took.
func ingest(t *testing.T, budget int, items []knowledge.AddItem) (latticeShape, int) {
	t.Helper()
	store := newCountingStore()
	opts := smallWindows
	opts.CommitWindowBudget = budget
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)
	results, err := k.AddBatch(context.Background(), "p", items)
	if err != nil {
		t.Fatalf("AddBatch at budget %d: %v", budget, err)
	}

	var shape latticeShape
	for i, it := range items {
		src, ok, err := store.SourceByOrigin("p", it.SourceType, it.SourceID)
		if err != nil || !ok {
			t.Fatalf("budget %d: source %q missing: ok=%v err=%v", budget, it.SourceID, ok, err)
		}
		windows, err := store.SourceWindows(src.LocalRefID)
		if err != nil {
			t.Fatalf("windows for %q: %v", it.SourceID, err)
		}
		for _, w := range windows {
			shape.windows = append(shape.windows, fmt.Sprintf("%s|%d-%d|%s", it.SourceID, w.Start, w.End, w.Text))
		}
		shape.forests = append(shape.forests,
			fmt.Sprintf("%s|%d|%d", it.SourceID, results[i].Windows, results[i].Nodes))
	}
	frontier, err := store.EntryFrontier("p")
	if err != nil {
		t.Fatalf("frontier: %v", err)
	}
	shape.frontier = len(frontier)
	sort.Strings(shape.windows)
	return shape, store.writes
}

// Slicing must not change what gets built. Whatever the commit budget, the same
// content produces the same windows, the same ranges and the same clusters — a
// slice boundary is a commit boundary and nothing else.
//
// A budget of 1 is the extreme worth pinning: it commits after every window, so
// if any per-source state leaked across a slice boundary this is where it shows.
func TestSlicedIngestBuildsTheSameLatticeAsOneBatch(t *testing.T) {
	items := slicingItems(8)
	whole, wholeWrites := ingest(t, 0, items)

	for _, budget := range []int{1, 2, 5, 1000} {
		sliced, writes := ingest(t, budget, items)
		if len(sliced.windows) != len(whole.windows) {
			t.Fatalf("budget %d: %d windows, want %d", budget, len(sliced.windows), len(whole.windows))
		}
		for i := range whole.windows {
			if sliced.windows[i] != whole.windows[i] {
				t.Errorf("budget %d, window %d:\n got %q\nwant %q", budget, i, sliced.windows[i], whole.windows[i])
			}
		}
		for i := range whole.forests {
			if sliced.forests[i] != whole.forests[i] {
				t.Errorf("budget %d, forest %d: got %q, want %q", budget, i, sliced.forests[i], whole.forests[i])
			}
		}
		if sliced.frontier != whole.frontier {
			t.Errorf("budget %d: %d frontier entries, want %d", budget, sliced.frontier, whole.frontier)
		}
		t.Logf("budget %d: %d store writes (whole batch: %d)", budget, writes, wholeWrites)
	}
}

// The point of slicing: a small budget really does commit more than once. Without
// this the test above would pass on an implementation that ignored the budget
// entirely.
func TestASmallBudgetCommitsInSeveralSlices(t *testing.T) {
	items := slicingItems(8)
	_, wholeWrites := ingest(t, 0, items)
	_, slicedWrites := ingest(t, 2, items)

	if wholeWrites != 1 {
		t.Errorf("unbudgeted ingest took %d writes, want exactly 1", wholeWrites)
	}
	if slicedWrites <= wholeWrites {
		t.Errorf("budget 2 took %d writes, want more than the %d of one batch", slicedWrites, wholeWrites)
	}
}

// One embedding call per slice, not one per window. The provider cost that
// batching exists to control is per *call*, so a slice must still gather every
// source in it into a single request.
func TestEachSliceMakesOneEmbedCall(t *testing.T) {
	store := newCountingStore()
	emb := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	opts := smallWindows
	opts.CommitWindowBudget = 4
	k := knowledge.New(store, emb, opts)

	if _, err := k.AddBatch(context.Background(), "p", slicingItems(6)); err != nil {
		t.Fatal(err)
	}
	if emb.calls != store.writes {
		t.Errorf("%d embed calls for %d commits, want one call per commit", emb.calls, store.writes)
	}
	if emb.calls < 2 {
		t.Fatalf("budget 4 produced %d embed call(s); the batch did not slice", emb.calls)
	}
	for i, b := range emb.batches {
		if len(b) == 0 {
			t.Errorf("embed call %d sent no texts", i)
		}
	}
}

// However many slices a sync commits, the corpus tier is rebuilt once. The
// rebuild is O(F²) in the project's whole frontier, so paying it per slice would
// make slicing cost more than the memory it saves.
func TestSlicingStillQueuesOneCorpusRebuild(t *testing.T) {
	store := newCountingStore()
	opts := smallWindows
	opts.CommitWindowBudget = 1
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)

	if _, err := k.AddBatch(context.Background(), "p", slicingItems(6)); err != nil {
		t.Fatal(err)
	}
	if err := k.RebuildCorpus(context.Background(), "p"); err != nil {
		t.Fatalf("rebuild: %v", err)
	}
	if store.rebuilds != 1 {
		t.Errorf("%d corpus rebuilds, want 1", store.rebuilds)
	}
	if store.writes < 3 {
		t.Fatalf("budget 1 produced %d writes; the batch did not slice", store.writes)
	}
}

// failAfterEmbedder serves n calls and then fails, standing in for a provider
// that dies partway through a large sync.
type failAfterEmbedder struct {
	inner fakeEmbedder
	calls int
	limit int
}

func (f *failAfterEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	f.calls++
	if f.calls > f.limit {
		return knowledge.Embedded{}, errors.New("provider gave up")
	}
	out, err := f.inner.Embed(ctx, texts)
	// Reports token usage, unlike the shared fake. A partial sync's whole point is
	// that it already SPENT something, so a fixture reporting zero cannot tell a
	// lost cost from a free one.
	out.Usage = knowledge.Usage{PromptTokens: 10 * len(texts), TotalTokens: 10 * len(texts)}
	return out, err
}

// The reason slicing exists. A sync that dies partway leaves the slices it
// finished committed, and the retry skips them.
//
// Unsliced, a failure discarded the whole batch and the retry re-embedded from
// zero — so a connector whose sync could not complete in one go never completed
// at all, and paid full price for every attempt. Forward progress is the fix.
func TestAFailedSliceLeavesEarlierSlicesCommitted(t *testing.T) {
	store := newCountingStore()
	failing := &failAfterEmbedder{inner: fakeEmbedder{dim: 128}, limit: 2}
	opts := smallWindows
	opts.CommitWindowBudget = 2
	k := knowledge.New(store, failing, opts)
	items := slicingItems(8)
	ctx := context.Background()

	if _, err := k.AddBatch(ctx, "p", items); err == nil {
		t.Fatal("want an error when the embedder fails mid-sync")
	}

	committed := 0
	for _, it := range items {
		if _, ok, _ := store.SourceByOrigin("p", it.SourceType, it.SourceID); ok {
			committed++
		}
	}
	if committed == 0 {
		t.Fatal("the failed sync committed nothing — no forward progress")
	}
	if committed == len(items) {
		t.Fatal("the failed sync committed everything — the fixture did not fail")
	}
	t.Logf("%d of %d sources survived the failure", committed, len(items))

	// The retry completes, and pays nothing for what already landed.
	working := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	k2 := knowledge.New(store, working, opts)
	results, err := k2.AddBatch(ctx, "p", items)
	if err != nil {
		t.Fatalf("retry: %v", err)
	}
	skipped := 0
	for i, r := range results {
		if r.Skipped {
			skipped++
		} else if r.Embedded == 0 && r.Windows == 0 {
			t.Errorf("item %d neither skipped nor rebuilt: %+v", i, r)
		}
	}
	if skipped != committed {
		t.Errorf("retry skipped %d sources, want the %d already committed", skipped, committed)
	}
	for _, it := range items {
		if _, ok, _ := store.SourceByOrigin("p", it.SourceType, it.SourceID); !ok {
			t.Errorf("source %q still missing after the retry", it.SourceID)
		}
	}
}

// driftingEmbedder answers the first call under one identity and every later call
// under another — an embedding route re-pointed while a sync is in flight.
type driftingEmbedder struct {
	dim   int
	calls int
}

func (d *driftingEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	d.calls++
	inner := fakeEmbedder{dim: d.dim, identity: knowledge.VectorIdentity{Provider: "fake", Model: "first", Dims: d.dim}}
	if d.calls > 1 {
		inner.identity = knowledge.VectorIdentity{Provider: "fake", Model: "second", Dims: d.dim}
	}
	return inner.Embed(ctx, texts)
}

// The identity is pinned for the whole sync, and a slice that comes back from a
// different embedding space aborts rather than commits.
//
// This is the failure slicing introduces and nothing else in the system would
// catch in time. Vectors from two spaces share no basis: they do not error, they
// retrieve nothing. Committing slice 1 under one model and slice 2 under another
// would leave a project that is silently, permanently unsearchable — retrieval
// refuses with ErrIdentityMismatch, and every stored vector would have to be
// bought again to recover.
func TestAnIdentityChangeMidSyncAbortsInsteadOfMixingSpaces(t *testing.T) {
	store := newCountingStore()
	opts := smallWindows
	opts.CommitWindowBudget = 2
	k := knowledge.New(store, &driftingEmbedder{dim: 128}, opts)
	items := slicingItems(8)

	_, err := k.AddBatch(context.Background(), "p", items)
	if err == nil {
		t.Fatal("want an error when the embedding identity changes mid-sync")
	}
	if !strings.Contains(err.Error(), "identity") {
		t.Errorf("error should name the identity change, got: %v", err)
	}

	identities, err := store.Identities("p")
	if err != nil {
		t.Fatal(err)
	}
	seen := map[knowledge.VectorIdentity]int{}
	for _, id := range identities {
		seen[id]++
	}
	if len(seen) > 1 {
		t.Errorf("project holds %d embedding spaces, want at most 1: %+v", len(seen), seen)
	}
	for id := range seen {
		if id.Model != "first" {
			t.Errorf("committed under %q, want the pinned first identity", id.Model)
		}
	}
}

// A single source larger than the whole budget still ingests. The budget bounds
// how much is held between commits; it is not a limit on what may be admitted,
// and treating it as one would refuse exactly the large files this work exists
// to support.
func TestASourceBiggerThanTheBudgetStillIngests(t *testing.T) {
	store := newCountingStore()
	opts := smallWindows
	opts.CommitWindowBudget = 1
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)

	var sb strings.Builder
	for i := 0; i < 40; i++ {
		fmt.Fprintf(&sb, "Paragraph %d of one long document about a single subject at length. ", i)
	}
	res, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, "big", "", sb.String(), nil, 0)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if res.Windows < 2 {
		t.Fatalf("fixture produced %d window(s); it must exceed the budget to be a test", res.Windows)
	}
	if _, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "big"); !ok {
		t.Error("a source larger than the commit budget was not stored")
	}
}

// Reusing every vector in a source cannot bypass the active generation's frozen
// embedding space. A configured identity change is an explicit migration, not
// an ordinary sliced sync.
func TestASliceThatOnlyReusesVectorsCannotChangeTheActiveSpace(t *testing.T) {
	store := knowledge.NewMemoryStore()
	ctx := context.Background()
	opts := smallWindows
	opts.CommitWindowBudget = 1

	// Sync one source under the FIRST identity and leave it there.
	old := knowledge.VectorIdentity{Provider: "fake", Model: "old", Dims: 64}
	first := knowledge.New(store, fakeEmbedder{dim: 64, identity: old}, opts)
	stale := strings.Repeat("Content that will not change between syncs. ", 30)
	if _, err := first.Add(ctx, "p", knowledge.SourceTypeDocument, "stale", "", stale, nil, 0); err != nil {
		t.Fatal(err)
	}

	// A sync under a different identity includes both the unchanged source and a
	// new source. Neither may be committed to the old active generation.
	fresh := knowledge.VectorIdentity{Provider: "fake", Model: "new", Dims: 64}
	second := knowledge.New(store, fakeEmbedder{dim: 64, identity: fresh}, opts)
	_, err := second.AddBatch(ctx, "p", []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "fresh", Label: "changed",
			Content: knowledge.TextContent(strings.Repeat("Brand new content for a brand new source. ", 30))},
		// Re-added with a changed LABEL so it is not skipped outright, while every
		// window's text — and therefore every vector — is reused unchanged.
		{SourceType: knowledge.SourceTypeDocument, SourceID: "stale", Label: "relabelled",
			Content: knowledge.TextContent(stale)},
	})

	if !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
		t.Fatalf("sync error = %v, want ErrEmbeddingSpaceChangeRequired", err)
	}
	if _, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "fresh"); ok {
		t.Fatal("new-space source was committed to the old active generation")
	}

	// The stale source keeps the identity it already had — it was not rewritten
	// under the pin, which would have paired old vectors with a new space's name and
	// made the mismatch undetectable.
	src, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "stale")
	if !ok {
		t.Fatal("the stale source vanished")
	}
	if src.Identity != old {
		t.Errorf("stale source now claims %+v, want the %+v its vectors actually belong to", src.Identity, old)
	}
}

// An untouched old-space source plus a new-space add was ING-6: it used to create
// a mixed project and make retrieval refuse everything. The generation root now
// rejects that ordinary add while preserving the old active lattice.
func TestAnUntouchedSourceCannotBeMixedByOrdinaryIngest(t *testing.T) {
	store := knowledge.NewMemoryStore()
	ctx := context.Background()

	old := knowledge.VectorIdentity{Provider: "fake", Model: "old", Dims: 64}
	first := knowledge.New(store, fakeEmbedder{dim: 64, identity: old}, smallWindows)
	if _, err := first.Add(ctx, "p", knowledge.SourceTypeDocument, "untouched", "",
		strings.Repeat("An older source nobody re-syncs. ", 30), nil, 0); err != nil {
		t.Fatal(err)
	}

	fresh := knowledge.VectorIdentity{Provider: "fake", Model: "new", Dims: 64}
	second := knowledge.New(store, fakeEmbedder{dim: 64, identity: fresh}, smallWindows)
	if _, err := second.Add(ctx, "p", knowledge.SourceTypeDocument, "added", "",
		strings.Repeat("A newer source under a different model. ", 30), nil, 0); !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
		t.Fatalf("add error = %v, want ErrEmbeddingSpaceChangeRequired", err)
	}
	if _, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "added"); ok {
		t.Fatal("new-space source was committed to the active old-space generation")
	}
	identities, err := store.Identities("p")
	if err != nil {
		t.Fatal(err)
	}
	for _, identity := range identities {
		if identity != old {
			t.Fatalf("active generation contains %+v, want only %+v", identity, old)
		}
	}
}

// A sync that fails partway still reports what its committed slices cost.
//
// AddBatch returned nil on error, so the caller had no way to learn what it had
// already paid for. Those slices bought embeddings with real money — the sync
// simply recorded no cost, and the spend was invisible in exactly the case worth
// watching: the one that failed after paying.
func TestAFailedSyncStillReportsWhatItSpent(t *testing.T) {
	store := newCountingStore()
	failing := &failAfterEmbedder{inner: fakeEmbedder{dim: 128}, limit: 2}
	opts := smallWindows
	opts.CommitWindowBudget = 2
	k := knowledge.New(store, failing, opts)
	items := slicingItems(8)

	results, err := k.AddBatch(context.Background(), "p", items)
	if err == nil {
		t.Fatal("want an error when the embedder fails mid-sync")
	}
	if results == nil {
		t.Fatal("results were discarded on failure, so the committed slices' cost is unknowable")
	}
	if len(results) != len(items) {
		t.Fatalf("got %d results for %d items", len(results), len(items))
	}

	spent, committed := 0, 0
	for _, r := range results {
		spent += r.Usage.TotalTokens
		if r.Windows > 0 {
			committed++
		}
	}
	if committed == 0 {
		t.Fatal("nothing committed, so the fixture does not test this")
	}
	if spent == 0 {
		t.Errorf("%d source(s) committed but the reported cost is zero", committed)
	}
	t.Logf("%d of %d sources committed, %d tokens reported", committed, len(items), spent)
}

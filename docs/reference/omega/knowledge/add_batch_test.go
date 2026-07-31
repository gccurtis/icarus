package knowledge_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// callCountingEmbedder records how many Embed CALLS were made (not how many
// texts), which is the number a rate limit actually cares about.
type callCountingEmbedder struct {
	inner   fakeEmbedder
	calls   int
	batches [][]string
	err     error
}

func (c *callCountingEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	c.calls++
	c.batches = append(c.batches, append([]string(nil), texts...))
	if c.err != nil {
		return knowledge.Embedded{}, c.err
	}
	return c.inner.Embed(ctx, texts)
}

// countingStore wraps MemoryStore to count store writes and corpus rebuilds —
// the two costs batching exists to pay once instead of once per source.
type countingStore struct {
	*knowledge.MemoryStore
	rebuilds int
	writes   int
}

func (s *countingStore) ReplaceSources(writes []knowledge.SourceWrite) error {
	s.writes++
	return s.MemoryStore.ReplaceSources(writes)
}

func (s *countingStore) AdmitAndReplaceSources(maxArtifacts int, writes []knowledge.SourceWrite) (knowledge.ArtifactCounts, error) {
	s.writes++
	return s.MemoryStore.AdmitAndReplaceSources(maxArtifacts, writes)
}

func (s *countingStore) RebuildCorpus(projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	s.rebuilds++
	return s.MemoryStore.RebuildCorpus(projectID, corpus, seq, indexes)
}

func (s *countingStore) AdmitCorpus(projectID string, maxArtifacts int, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) (knowledge.ArtifactCounts, error) {
	s.rebuilds++
	return s.MemoryStore.AdmitCorpus(projectID, maxArtifacts, corpus, seq, indexes)
}

func (s *countingStore) AdmitAndReplaceActive(token knowledge.ReadToken, maxArtifacts int, writes []knowledge.SourceWrite, at time.Time) (knowledge.ArtifactCounts, knowledge.ReadToken, error) {
	s.writes++
	return s.MemoryStore.AdmitAndReplaceActive(token, maxArtifacts, writes, at)
}

func (s *countingStore) ForGeneration(generationID string) knowledge.ArtifactStore {
	return countingArtifacts{ArtifactStore: s.MemoryStore.ForGeneration(generationID), parent: s}
}

type countingArtifacts struct {
	knowledge.ArtifactStore
	parent *countingStore
}

func (s countingArtifacts) RebuildCorpus(projectID string, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) error {
	s.parent.rebuilds++
	return s.ArtifactStore.RebuildCorpus(projectID, corpus, seq, indexes)
}

func (s countingArtifacts) AdmitCorpus(projectID string, maxArtifacts int, corpus []knowledge.Node, seq int64, indexes []knowledge.CorpusLevelIndex) (knowledge.ArtifactCounts, error) {
	s.parent.rebuilds++
	return s.ArtifactStore.AdmitCorpus(projectID, maxArtifacts, corpus, seq, indexes)
}

func newCountingStore() *countingStore {
	return &countingStore{MemoryStore: knowledge.NewMemoryStore()}
}

// The two costs batching exists to collapse: N sources must produce ONE embedding
// call and ONE corpus rebuild, not N of each.
func TestAddBatchMakesOneEmbedCallAndOneRebuild(t *testing.T) {
	store := newCountingStore()
	emb := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	k := knowledge.New(store, emb, smallWindows)

	// Deliberately uneven window counts, so a scatter that assumed a fixed stride
	// would land vectors on the wrong sources.
	items := []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d1", Label: "one",
			Content: knowledge.TextContent(strings.Repeat("alpha beta gamma. ", 3))},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d2", Label: "two",
			Content: knowledge.TextContent(strings.Repeat("delta epsilon zeta eta theta iota. ", 30))},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d3", Label: "three",
			Content: knowledge.TextContent(strings.Repeat("kappa lambda. ", 12))},
	}
	results, err := k.AddBatch(context.Background(), "p1", items)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != len(items) {
		t.Fatalf("got %d results for %d items", len(results), len(items))
	}
	if emb.calls != 1 {
		t.Errorf("embedder called %d times, want 1 — the batch is the whole point", emb.calls)
	}
	if store.writes != 1 {
		t.Errorf("%d store writes, want 1 transaction", store.writes)
	}
	// The write defers the rebuild rather than paying for it inline.
	if store.rebuilds != 0 {
		t.Errorf("corpus rebuilt %d times during the write; it must be deferred", store.rebuilds)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || current {
		t.Errorf("corpus reads current after a write: %v %v", current, err)
	}
	// And one rebuild brings the whole batch current, however many sources moved.
	if err := k.RebuildCorpus(context.Background(), "p1"); err != nil {
		t.Fatal(err)
	}
	if store.rebuilds != 1 {
		t.Errorf("corpus rebuilt %d times, want 1", store.rebuilds)
	}
	if current, err := k.CorpusCurrent("p1"); err != nil || !current {
		t.Errorf("corpus still stale after a rebuild: %v %v", current, err)
	}
	// A second rebuild with nothing new is free — which is what makes
	// over-scheduling harmless.
	if err := k.RebuildCorpus(context.Background(), "p1"); err != nil {
		t.Fatal(err)
	}
	if store.rebuilds != 1 {
		t.Errorf("a rebuild with nothing dirty still wrote: %d", store.rebuilds)
	}

	total := 0
	for i, r := range results {
		if r.Windows == 0 {
			t.Errorf("item %d produced no windows", i)
		}
		total += r.Embedded
	}
	if got := len(emb.batches[0]); got != total {
		t.Errorf("batch carried %d texts but results claim %d embedded", got, total)
	}
}

// Every source must end up with the vectors for ITS OWN text. This is the failure
// a scatter/gather invites: an off-by-one produces perfectly plausible vectors
// attached to the wrong source, and nothing downstream can detect it. Proven by
// retrieving each source's distinctive vocabulary and requiring it to win.
func TestAddBatchLandsVectorsOnTheRightSource(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 256}, smallWindows)
	ctx := context.Background()

	items := []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "birds", Label: "birds",
			Content: knowledge.TextContent(strings.Repeat("sparrow finch heron plumage migration. ", 8))},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "engines", Label: "engines",
			Content: knowledge.TextContent(strings.Repeat("piston crankshaft torque camshaft combustion. ", 20))},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "bread", Label: "bread",
			Content: knowledge.TextContent(strings.Repeat("sourdough levain crumb hydration proofing. ", 5))},
	}
	if _, err := k.AddBatch(ctx, "p1", items); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ query, wantSource string }{
		{"sparrow finch heron", "birds"},
		{"piston crankshaft torque", "engines"},
		{"sourdough levain crumb", "bread"},
	} {
		res, err := k.Retrieve(ctx, "p1", tc.query, 3)
		if err != nil {
			t.Fatal(err)
		}
		if len(res.Regions) == 0 {
			t.Fatalf("query %q retrieved nothing", tc.query)
		}
		if got := res.Regions[0].SourceID; got != tc.wantSource {
			t.Errorf("query %q → source %q, want %q: vectors landed on the wrong source",
				tc.query, got, tc.wantSource)
		}
	}
}

// A batch mixing unchanged and changed sources embeds only what changed, and the
// skip is reported per item rather than collapsing the whole batch.
func TestAddBatchSkipsUnchangedItemsWithinTheBatch(t *testing.T) {
	store := newCountingStore()
	emb := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	k := knowledge.New(store, emb, smallWindows)
	ctx := context.Background()

	a := strings.Repeat("alpha beta gamma delta. ", 10)
	b := strings.Repeat("epsilon zeta eta theta. ", 10)
	items := []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d1", Content: knowledge.TextContent(a)},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d2", Content: knowledge.TextContent(b)},
	}
	if _, err := k.AddBatch(ctx, "p1", items); err != nil {
		t.Fatal(err)
	}

	emb.calls, store.rebuilds, store.writes, emb.batches = 0, 0, 0, nil
	items[1].Content = knowledge.TextContent(b + "iota kappa lambda a genuinely new tail here. ")
	results, err := k.AddBatch(ctx, "p1", items)
	if err != nil {
		t.Fatal(err)
	}
	if !results[0].Skipped {
		t.Errorf("unchanged item was not skipped: %+v", results[0])
	}
	if results[1].Skipped {
		t.Errorf("changed item was skipped: %+v", results[1])
	}
	if emb.calls != 1 {
		t.Errorf("embedder called %d times, want 1", emb.calls)
	}
	// Only the changed source's new windows travel.
	for _, text := range emb.batches[0] {
		if strings.Contains(text, "alpha beta") {
			t.Errorf("unchanged source's text was embedded: %q", text)
		}
	}
	if store.writes != 1 {
		t.Errorf("%d store writes, want 1", store.writes)
	}
}

// A batch where nothing changed touches neither the provider nor the store.
func TestAddBatchWithNothingChangedDoesNoWork(t *testing.T) {
	store := newCountingStore()
	emb := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	k := knowledge.New(store, emb, smallWindows)
	ctx := context.Background()

	items := []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d1", Content: knowledge.TextContent(strings.Repeat("alpha beta. ", 10))},
	}
	if _, err := k.AddBatch(ctx, "p1", items); err != nil {
		t.Fatal(err)
	}
	emb.calls, store.rebuilds, store.writes = 0, 0, 0

	results, err := k.AddBatch(ctx, "p1", items)
	if err != nil {
		t.Fatal(err)
	}
	if !results[0].Skipped {
		t.Errorf("want skipped, got %+v", results[0])
	}
	if emb.calls != 0 || store.writes != 0 || store.rebuilds != 0 {
		t.Errorf("a no-op batch did work: embed=%d writes=%d rebuilds=%d",
			emb.calls, store.writes, store.rebuilds)
	}
}

// A failed embed must leave the existing lattice completely intact. This is the
// property that makes a rate limit a retryable inconvenience rather than data
// loss — and it is why the write happens after the embed, in one transaction.
func TestAddBatchFailureLeavesTheLatticeUntouched(t *testing.T) {
	store := knowledge.NewMemoryStore()
	emb := &callCountingEmbedder{inner: fakeEmbedder{dim: 128}}
	k := knowledge.New(store, emb, smallWindows)
	ctx := context.Background()

	good := strings.Repeat("alpha beta gamma delta. ", 10)
	if _, err := k.AddBatch(ctx, "p1", []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d1", Label: "keep", Content: knowledge.TextContent(good)},
	}); err != nil {
		t.Fatal(err)
	}
	before, _ := store.ProjectWindows("p1")

	// Now a batch that will fail mid-flight.
	emb.err = errors.New("provider is rate limiting")
	_, err := k.AddBatch(ctx, "p1", []knowledge.AddItem{
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d1", Label: "keep", Content: knowledge.TextContent(good + "changed tail. ")},
		{SourceType: knowledge.SourceTypeDocument, SourceID: "d2", Label: "new", Content: knowledge.TextContent(strings.Repeat("zeta eta. ", 10))},
	})
	if err == nil {
		t.Fatal("want an error when the embedder fails")
	}

	after, _ := store.ProjectWindows("p1")
	if len(after) != len(before) {
		t.Errorf("failed batch changed the lattice: %d windows before, %d after", len(before), len(after))
	}
	src, ok, _ := store.SourceByOrigin("p1", knowledge.SourceTypeDocument, "d1")
	if !ok || src.ContentHash != knowledge.ContentHash(good) {
		t.Errorf("failed batch damaged the existing source: ok=%v hash=%q want %q",
			ok, src.ContentHash, knowledge.ContentHash(good))
	}
	if _, ok, _ := store.SourceByOrigin("p1", knowledge.SourceTypeDocument, "d2"); ok {
		t.Error("failed batch partially wrote a new source")
	}
}

// An empty batch is a no-op, not an error.
func TestAddBatchEmpty(t *testing.T) {
	store := newCountingStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	results, err := k.AddBatch(context.Background(), "p1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 0 {
		t.Errorf("got %d results for an empty batch", len(results))
	}
	if store.writes != 0 {
		t.Errorf("an empty batch wrote to the store")
	}
}

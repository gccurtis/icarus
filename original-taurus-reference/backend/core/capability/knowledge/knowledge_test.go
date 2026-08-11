package knowledge_test

import (
	"context"
	"errors"
	"hash/fnv"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// smallWindows keeps the test texts multi-window under the production-sized
// default window target.
var smallWindows = knowledge.Options{WindowTargetRunes: 200, WindowOverlapRunes: 40}

// These unit tests use a fake embedder to prove the *plumbing* — windowing, the
// lattice being built and stored, re-add semantics, and retrieval returning
// structurally valid, provenance-carrying hits. Clustering and retrieval
// *quality* can only be judged with real embeddings, so that is verified live in
// dev-test/knowledge, not here.

// fakeEmbedder maps text to a bag-of-words vector, so texts sharing words get
// similar vectors — enough to run the pipeline deterministically without a
// provider. It is not representative of a real embedding space.
type fakeEmbedder struct {
	dim      int
	identity knowledge.VectorIdentity
}

func (f fakeEmbedder) Embed(_ context.Context, texts []string) (knowledge.Embedded, error) {
	out := make([][]float64, len(texts))
	for i, t := range texts {
		v := make([]float64, f.dim)
		for _, w := range strings.Fields(strings.ToLower(t)) {
			h := fnv.New32a()
			_, _ = h.Write([]byte(w))
			v[h.Sum32()%uint32(f.dim)] += 1
		}
		out[i] = v
	}
	identity := f.identity
	if identity == (knowledge.VectorIdentity{}) {
		identity = knowledge.VectorIdentity{Provider: "fake", Model: "bag-of-words", Dims: f.dim}
	}
	return knowledge.Embedded{Vectors: out, Identity: identity}, nil
}

// routingEmbedder models production's identity-addressable provider registry:
// ordinary Embed follows the current configured route, while EmbedInSpace can
// still query a retained active/rollback generation after that route changes.
type routingEmbedder struct {
	current knowledge.VectorIdentity
}

func (r routingEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	return fakeEmbedder{dim: r.current.Dims, identity: r.current}.Embed(ctx, texts)
}

func (r routingEmbedder) EmbedInSpace(ctx context.Context, space knowledge.EmbeddingSpace, texts []string) (knowledge.Embedded, error) {
	id := space.VectorIdentity()
	return fakeEmbedder{dim: id.Dims, identity: id}.Embed(ctx, texts)
}

func (r routingEmbedder) ConfiguredSpace(context.Context) (knowledge.EmbeddingSpace, error) {
	return knowledge.SpaceForIdentity(r.current), nil
}

// loadLattice reconstructs every node and window of a project from the narrow
// store reads, by walking the entry frontier down through membership. It exists
// so the plumbing tests can still inspect the whole lattice.
func loadLattice(t *testing.T, store *knowledge.MemoryStore, projectID string) ([]knowledge.Node, []knowledge.Window) {
	t.Helper()
	windows, err := store.ProjectWindows(projectID)
	if err != nil {
		t.Fatal(err)
	}
	frontier, err := store.EntryFrontier(projectID)
	if err != nil {
		t.Fatal(err)
	}
	var queue []string
	for _, f := range frontier {
		if !f.IsWindow {
			queue = append(queue, f.ID)
		}
	}
	seen := map[string]bool{}
	var nodes []knowledge.Node
	for len(queue) > 0 {
		batch, err := store.NodesByID(queue)
		if err != nil {
			t.Fatal(err)
		}
		queue = nil
		for _, n := range batch {
			if seen[n.ID] {
				continue
			}
			seen[n.ID] = true
			nodes = append(nodes, n)
			queue = append(queue, n.MemberIDs...)
		}
	}
	return nodes, windows
}

func TestAddBuildsLatticeAndRetrieves(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	var sb strings.Builder
	for i := 0; i < 30; i++ {
		sb.WriteString("the quick brown fox jumps over the lazy dog nearby. ")
	}
	sb.WriteString("zebra xylophone quantum volcano orbital marker passage about eruptions. ")
	for i := 0; i < 30; i++ {
		sb.WriteString("common filler words repeated many times right here today. ")
	}
	text := sb.String()

	res, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", text, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	// The repetitive text makes near-identical windows, so at least one clique
	// must form. Nothing forces a single root: a forest is fine.
	if res.Windows < 2 || res.Nodes < 1 {
		t.Fatalf("lattice too small: %+v", res)
	}
	if res.Source.SourceType != knowledge.SourceTypeDocument || res.Source.SourceID != "doc1" || res.Source.LocalRefID == "" {
		t.Errorf("source = %+v", res.Source)
	}

	// Every stored node is a real cluster: at least two members, all resolving to
	// stored windows or other nodes, cohesion in range.
	nodes, windows := loadLattice(t, store, "p")
	known := map[string]bool{}
	for _, w := range windows {
		known[w.ID] = true
	}
	for _, n := range nodes {
		known[n.ID] = true
	}
	for _, n := range nodes {
		if n.Count < 2 || len(n.MemberIDs) != n.Count {
			t.Errorf("node is not a cluster: %+v", n)
		}
		if n.Cohesion <= 0 || n.Cohesion > 1.0000001 {
			t.Errorf("cohesion out of range: %+v", n)
		}
		for _, m := range n.MemberIDs {
			if !known[m] {
				t.Errorf("node %s references unknown member %s", n.ID, m)
			}
		}
	}

	// Plumbing only: retrieval returns hits that carry provenance and resolve back
	// to real source text. Whether the *best* passage ranks first is a quality
	// question left to the live suite.
	rres, err := k.Retrieve(ctx, "p", "zebra xylophone quantum volcano orbital eruptions", 3)
	if err != nil {
		t.Fatal(err)
	}
	hits := rres.Regions
	if len(hits) == 0 {
		t.Fatal("retrieval returned no hits")
	}
	for _, h := range hits {
		if h.SourceID != "doc1" || h.SourceType != knowledge.SourceTypeDocument {
			t.Errorf("hit provenance = %+v", h)
		}
		if !strings.Contains(text, h.Text) || h.Text == "" {
			t.Errorf("hit text does not resolve to the source: %q", h.Text)
		}
	}
}

func TestReAddPreservesAddedAtAndCorpusTier(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()
	long := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta. ", 40)

	first, _ := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", long, nil, 0)
	// Re-adding the same origin keeps AddedAt, advances SyncedAt, same LocalRefID.
	second, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", long+"extra tail sentence.", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !second.Source.AddedAt.Equal(first.Source.AddedAt) {
		t.Errorf("AddedAt changed on re-add: %v -> %v", first.Source.AddedAt, second.Source.AddedAt)
	}
	if second.Source.LocalRefID != first.Source.LocalRefID {
		t.Errorf("LocalRefID changed on re-add")
	}
	if !second.Source.SyncedAt.After(first.Source.SyncedAt) && !second.Source.SyncedAt.Equal(first.Source.SyncedAt) {
		t.Errorf("SyncedAt went backwards")
	}

	// A second, related source: the corpus tier is rebuilt from both sources'
	// frontiers. With overlapping vocabulary the frontiers are similar enough to
	// cluster, so a corpus node (LocalRefID == "") must appear, and its members
	// must be real frontier artifacts.
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc2", "", strings.Repeat("alpha beta gamma delta epsilon zeta eta iota. ", 40), nil, 0); err != nil {
		t.Fatal(err)
	}
	// The corpus tier is built off the write path, so it is driven explicitly here
	// rather than racing a worker — this is the production code path, just called
	// synchronously.
	if err := k.RebuildCorpus(ctx, "p"); err != nil {
		t.Fatal(err)
	}
	nodes, windows := loadLattice(t, store, "p")
	known := map[string]bool{}
	for _, w := range windows {
		known[w.ID] = true
	}
	for _, n := range nodes {
		known[n.ID] = true
	}
	corpus := 0
	for _, n := range nodes {
		if n.LocalRefID == "" {
			corpus++
			for _, m := range n.MemberIDs {
				if !known[m] {
					t.Errorf("corpus node references unknown member %s", m)
				}
			}
		}
	}
	if corpus == 0 {
		t.Fatal("no corpus node formed over two near-identical sources")
	}

	// Retrieval still reaches both sources.
	res, err := k.Retrieve(ctx, "p", "alpha beta gamma delta", 10)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, h := range res.Regions {
		seen[h.SourceID] = true
	}
	if !seen["doc1"] || !seen["doc2"] {
		t.Errorf("retrieval did not reach both sources: %+v", res.Regions)
	}
}

// An orphan is never absorbed: a source whose windows share nothing must reach
// the corpus tier as bare frontier windows, not be forced into clusters.
func TestUnrelatedSourceStaysOrphaned(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 256}, smallWindows)
	ctx := context.Background()

	// Each sentence uses a disjoint vocabulary, so windows share almost no words.
	res, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("aardvark banjo crystal. ", 8)+
		strings.Repeat("dolphin ember frost. ", 8)+
		strings.Repeat("glacier harp iris. ", 8), nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if res.Windows == 0 {
		t.Fatal("no windows")
	}
	// Whatever clustered (or not), every window must either be a member of some
	// node or appear nowhere — never silently dropped.
	nodes, windows := loadLattice(t, store, "p")
	if len(windows) != res.Windows {
		t.Errorf("stored %d windows, add reported %d", len(windows), res.Windows)
	}
	for _, n := range nodes {
		if n.Count < 2 {
			t.Errorf("degenerate cluster: %+v", n)
		}
	}
}

// A hit's byte range maps back to the origin components it touches: retrieval
// cites real (row, block) addresses, not just offsets.
func TestHitsCarryBlockRefs(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()

	para1 := strings.Repeat("solar panels convert light. ", 6)
	para2 := strings.Repeat("wind turbines spin in gusts. ", 6)
	text := para1 + "\n" + para2 + "\n"
	blocks := []knowledge.BlockSpan{
		{RowID: "r1", BlockID: "b1", Start: 0, End: len(para1)},
		{RowID: "r1", BlockID: "b2", Start: len(para1) + 1, End: len(para1) + 1 + len(para2)},
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", text, blocks, 0); err != nil {
		t.Fatal(err)
	}
	res, err := k.Retrieve(ctx, "p", "wind turbines spin", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 {
		t.Fatal("no regions")
	}
	top := res.Regions[0]
	if len(top.Blocks) == 0 {
		t.Fatalf("top hit carries no block refs: %+v", top)
	}
	found := false
	for _, b := range top.Blocks {
		if b.RowID == "r1" && b.BlockID == "b2" {
			found = true
		}
	}
	if !found {
		t.Errorf("top hit for a wind query does not touch the wind block: %+v", top.Blocks)
	}
}

// A configured model change does not rewrite the active generation and does not
// make it unreadable: queries target the frozen identity explicitly, while an
// ordinary write reports that an administrative re-embed is required.
func TestConfigurationDriftPreservesActiveRetrievalAndRejectsOrdinaryRewrite(t *testing.T) {
	store := knowledge.NewMemoryStore()
	oldModel := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	k := knowledge.New(store, routingEmbedder{current: oldModel}, smallWindows)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("alpha beta gamma delta. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}

	// Same store, but the deployment route now resolves to a different model.
	newModel := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	k2 := knowledge.New(store, routingEmbedder{current: newModel}, smallWindows)
	if res, err := k2.Retrieve(ctx, "p", "alpha beta", 3); err != nil || len(res.Regions) == 0 {
		t.Fatalf("drifted deployment could not query retained active generation: %+v, %v", res, err)
	}

	if _, err := k2.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "",
		strings.Repeat("alpha beta gamma delta. ", 20)+"changed", nil, 1); !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
		t.Fatalf("ordinary write under drift = %v, want ErrEmbeddingSpaceChangeRequired", err)
	}
}

// Directed descent held to the reference oracle: on a small clusterable
// corpus, descent must recover the exact scan's top hit. The comparison lives
// HERE, against RetrieveExact — a separate named function — not behind a
// production audit flag.
func TestDescentMatchesExactOnCohesiveCorpus(t *testing.T) {
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.DescentThreshold = 0.05 // generous: this corpus is tiny
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("solar panels convert bright sunlight into clean electric power. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc2", "", strings.Repeat("orchestras rehearse symphonies with violins and brass nightly. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}

	res, err := k.Retrieve(ctx, "p", "solar panels sunlight electric power", 3)
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != "descent" {
		t.Errorf("mode = %q", res.Mode)
	}
	oracle, err := k.RetrieveExact(ctx, "p", "solar panels sunlight electric power", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) == 0 || len(oracle.Regions) == 0 {
		t.Fatalf("empty results: descent %d, exact %d", len(res.Regions), len(oracle.Regions))
	}
	if res.Regions[0].SourceID != oracle.Regions[0].SourceID {
		t.Errorf("descent top %q, exact top %q — descent lost the oracle's best hit",
			res.Regions[0].SourceID, oracle.Regions[0].SourceID)
	}
	if res.Regions[0].SourceID != "doc1" {
		t.Errorf("top region = %+v", res.Regions)
	}
}

// When the threshold prunes every path, descent falls back to the exact scan
// rather than returning an empty answer.
func TestDescentFallsBackWhenPrunedOut(t *testing.T) {
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.DescentThreshold = 0.99 // nothing clears this
	k := knowledge.New(store, fakeEmbedder{dim: 64}, opts)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("alpha beta gamma delta. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}
	res, err := k.Retrieve(ctx, "p", "completely unrelated query words", 3)
	if err != nil {
		t.Fatal(err)
	}
	if res.Mode != "exact-fallback" {
		t.Errorf("mode = %q", res.Mode)
	}
	if len(res.Regions) == 0 {
		t.Error("fallback returned no regions")
	}
}

// Overlapping retrieved windows of one source merge into one verbatim region
// whose density counts the converging windows — no near-duplicate spans.
func TestRegionsMergeOverlappingWindows(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	text := strings.Repeat("solar panels convert bright sunlight into power. ", 12)
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}
	res, err := k.Retrieve(ctx, "p", "solar panels sunlight power", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) != 1 {
		t.Fatalf("adjacent overlapping windows did not merge: %+v", res.Regions)
	}
	r := res.Regions[0]
	if r.Density < 2 {
		t.Errorf("density = %d, want >= 2 (merged windows)", r.Density)
	}
	if r.Text != text[r.Start:r.End] {
		t.Errorf("region text is not a verbatim slice of the source")
	}
	if len(res.Regions) > 0 && res.Regions[0].Relevance <= 0 {
		t.Errorf("relevance not carried: %+v", res.Regions[0])
	}
}

// The character budget bounds the output: with a tiny budget, only the top
// region is admitted (it is always admitted, even oversized).
func TestRegionsRespectCharBudget(t *testing.T) {
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.CharBudget = 50
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("solar panels convert sunlight. ", 10), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc2", "", strings.Repeat("wind turbines spin in gusts. ", 10), nil, 0); err != nil {
		t.Fatal(err)
	}
	res, err := k.Retrieve(ctx, "p", "solar panels sunlight", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Regions) != 1 {
		t.Fatalf("budget 50 admitted %d regions: %+v", len(res.Regions), res.Regions)
	}
	if res.Regions[0].SourceID != "doc1" {
		t.Errorf("budget kept the wrong region: %+v", res.Regions[0])
	}
}

// Remove deletes a source from the lattice, rebuilds the corpus tier, and
// retrieval no longer reaches it; the other source survives.
func TestRemoveDeletesSourceAndRebuildsCorpus(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", strings.Repeat("alpha beta gamma delta epsilon. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc2", "", strings.Repeat("orange purple silver bronze copper. ", 20), nil, 0); err != nil {
		t.Fatal(err)
	}

	res, err := k.Remove(ctx, "p", knowledge.SourceTypeDocument, "doc1")
	if err != nil {
		t.Fatal(err)
	}
	if !res.Removed {
		t.Fatal("Remove reported nothing removed")
	}

	// doc1 is gone from storage; doc2 remains.
	if _, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc1"); ok {
		t.Error("doc1 source still present after remove")
	}
	if _, ok, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc2"); !ok {
		t.Error("doc2 source removed by mistake")
	}
	// Every surviving window belongs to doc2 (doc1's are gone).
	doc2, _, _ := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc2")
	_, windows := loadLattice(t, store, "p")
	for _, w := range windows {
		if w.LocalRefID != doc2.LocalRefID {
			t.Errorf("a window from a removed source survives: %+v", w)
		}
	}

	// Retrieval only reaches doc2 now.
	rr, err := k.Retrieve(ctx, "p", "orange purple silver", 10)
	if err != nil {
		t.Fatal(err)
	}
	for _, region := range rr.Regions {
		if region.SourceID == "doc1" {
			t.Errorf("removed doc1 still retrievable: %+v", region)
		}
	}

	// Removing the last source empties the lattice; removing an unknown origin is
	// a no-op reporting Removed=false.
	if _, err := k.Remove(ctx, "p", knowledge.SourceTypeDocument, "doc2"); err != nil {
		t.Fatal(err)
	}
	if w, _ := store.ProjectWindows("p"); len(w) != 0 {
		t.Errorf("windows remain after removing every source: %d", len(w))
	}
	gone, err := k.Remove(ctx, "p", knowledge.SourceTypeDocument, "doc2")
	if err != nil {
		t.Fatal(err)
	}
	if gone.Removed {
		t.Error("removing an already-removed source reported Removed=true")
	}
}

// countingEmbedder wraps fakeEmbedder and tallies how many texts it was asked to
// embed, so a test can prove an update embedded only what changed.
type countingEmbedder struct {
	inner fakeEmbedder
	texts *int
}

func (c countingEmbedder) Embed(ctx context.Context, texts []string) (knowledge.Embedded, error) {
	*c.texts += len(texts)
	return c.inner.Embed(ctx, texts)
}

// Re-adding a document with an appended paragraph reuses every unchanged window's
// embedding and embeds only the new tail; re-adding identical text embeds nothing.
func TestAddReusesUnchangedEmbeddings(t *testing.T) {
	store := knowledge.NewMemoryStore()
	n := 0
	k := knowledge.New(store, countingEmbedder{fakeEmbedder{dim: 256}, &n}, smallWindows)
	ctx := context.Background()

	body := strings.Repeat("alpha beta gamma delta epsilon zeta. ", 20)
	first, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", body, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if first.Reused != 0 || first.Embedded != first.Windows || n != first.Windows {
		t.Fatalf("first add: reused=%d embedded=%d windows=%d embedded-texts=%d",
			first.Reused, first.Embedded, first.Windows, n)
	}

	// Append a distinct tail; only the changed windows should be embedded.
	n = 0
	second, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", body+"omega psi chi tau sigma appended tail sentence here. ", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if second.Reused == 0 {
		t.Errorf("append reused nothing: %+v", second)
	}
	if second.Embedded == 0 || second.Embedded >= second.Windows {
		t.Errorf("append should embed only the tail: embedded=%d windows=%d", second.Embedded, second.Windows)
	}
	if n != second.Embedded {
		t.Errorf("embedder was asked for %d texts but AddResult says %d embedded", n, second.Embedded)
	}

	// Re-adding identical text does not merely reuse the embeddings — it never
	// reaches the reuse map, because Add recognises the stored snapshot as
	// byte-identical and returns before windowing anything.
	n = 0
	third, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", body+"omega psi chi tau sigma appended tail sentence here. ", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !third.Skipped {
		t.Errorf("re-adding identical text did not skip: %+v", third)
	}
	if n != 0 {
		t.Errorf("skipped re-add still called the embedder %d time(s)", n)
	}
	if third.Windows != 0 || third.Nodes != 0 {
		t.Errorf("skipped re-add reported work done: windows=%d nodes=%d", third.Windows, third.Nodes)
	}
	if third.Usage != (knowledge.Usage{}) {
		t.Errorf("no-op re-add reported nonzero usage: %+v", third.Usage)
	}
	// SyncedAt must NOT advance. Nothing changed, so ProjectChangedSince should not
	// report a change and dependent prompt blocks should not re-resolve.
	if !third.Source.SyncedAt.Equal(second.Source.SyncedAt) {
		t.Errorf("skipped re-add advanced SyncedAt: %v -> %v", second.Source.SyncedAt, third.Source.SyncedAt)
	}
}

// The skip is keyed on what a retrieval actually depends on. A changed label or
// changed block structure must still rewrite the source, even when the flattened
// text is byte-identical — a citation resolving against stale block spans points
// at the wrong place, which is worse than paying for a re-cluster.
func TestAddDoesNotSkipWhenLabelOrBlocksChange(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()
	text := strings.Repeat("alpha beta gamma delta epsilon zeta. ", 20)
	blocks := []knowledge.BlockSpan{{RowID: "r1", BlockID: "b1", Start: 0, End: len(text)}}

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "Name", text, blocks, 0); err != nil {
		t.Fatal(err)
	}

	same, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "Name", text, blocks, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !same.Skipped {
		t.Fatalf("identical re-add should skip: %+v", same)
	}

	renamed, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "Renamed", text, blocks, 0)
	if err != nil {
		t.Fatal(err)
	}
	if renamed.Skipped {
		t.Error("a changed label was skipped; the stored label would stay stale")
	}

	split := []knowledge.BlockSpan{
		{RowID: "r1", BlockID: "b1", Start: 0, End: 10},
		{RowID: "r2", BlockID: "b2", Start: 10, End: len(text)},
	}
	restructured, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "d1", "Renamed", text, split, 0)
	if err != nil {
		t.Fatal(err)
	}
	if restructured.Skipped {
		t.Error("changed block structure was skipped; citations would resolve against the old blocks")
	}
}

// A connector bumps its sync sequence on every sync, so the skip must not key on
// revision — if it did, it would never fire for the caller it exists to help.
func TestAddSkipsEvenWhenRevisionAdvances(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	ctx := context.Background()
	text := strings.Repeat("alpha beta gamma delta epsilon zeta. ", 20)

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "c1/f1", "a.txt", text, nil, 1); err != nil {
		t.Fatal(err)
	}
	res, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "c1/f1", "a.txt", text, nil, 2)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Skipped {
		t.Fatalf("re-sync with an advanced revision but identical content did not skip: %+v", res)
	}
}

// A source edit under a different configured identity must not implicitly
// replace the Project's active vector space.
func TestAddRejectsImplicitIdentityChange(t *testing.T) {
	store := knowledge.NewMemoryStore()
	idA := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	ctx := context.Background()

	ka := knowledge.New(store, routingEmbedder{current: idA}, smallWindows)
	body := strings.Repeat("alpha beta gamma delta. ", 20)
	if _, err := ka.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", body, nil, 0); err != nil {
		t.Fatal(err)
	}

	idB := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	kb := knowledge.New(store, routingEmbedder{current: idB}, smallWindows)
	if _, err := kb.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "",
		body+"omega psi chi appended distinct tail here. ", nil, 0); !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
		t.Fatalf("identity-changing ordinary add = %v, want ErrEmbeddingSpaceChangeRequired", err)
	}
	source, ok, err := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc1")
	if err != nil || !ok || source.Identity != idA {
		t.Fatalf("active source changed after refusal: source=%+v ok=%v err=%v", source, ok, err)
	}
}

// RetrieveMany pools several queries into one consolidated result: it surfaces
// the regions matching ANY query, deduped, where a single query surfaces only
// its own topic. (Retrieval quality needs real embeddings; this proves the
// multi-query plumbing with the bag-of-words fake.)
func TestRetrieveManyPoolsAcrossQueries(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 256}, smallWindows)
	ctx := context.Background()

	filler := strings.Repeat("common filler words repeated here for spacing today. ", 8)
	text := filler +
		"alphamarker photosynthesis chloroplast sunlight leaves absorb. " + filler +
		"betamarker turbine rotor generator windmill blades spin. " + filler

	if _, err := k.Add(ctx, "p", knowledge.SourceTypeDocument, "doc1", "", text, nil, 0); err != nil {
		t.Fatal(err)
	}

	qA := "alphamarker photosynthesis chloroplast"
	qB := "betamarker turbine generator"

	// A single query surfaces only its own topic.
	solo, err := k.Retrieve(ctx, "p", qA, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !regionsContain(solo.Regions, "alphamarker") || regionsContain(solo.Regions, "betamarker") {
		t.Fatalf("single query should surface only alpha, got: %s", regionTexts(solo.Regions))
	}

	// The pooled call surfaces BOTH topics in one consolidated set.
	many, err := k.RetrieveMany(ctx, "p", []string{qA, qB}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !regionsContain(many.Regions, "alphamarker") || !regionsContain(many.Regions, "betamarker") {
		t.Errorf("pooled queries should surface both topics, got: %s", regionTexts(many.Regions))
	}
	// No region is duplicated (same source + byte range).
	type rk struct {
		id   string
		s, e int
	}
	seen := map[rk]bool{}
	for _, r := range many.Regions {
		key := rk{r.SourceID, r.Start, r.End}
		if seen[key] {
			t.Errorf("duplicate region in pooled result: %+v", key)
		}
		seen[key] = true
	}
}

func regionsContain(regions []knowledge.Region, sub string) bool {
	for _, r := range regions {
		if strings.Contains(r.Text, sub) {
			return true
		}
	}
	return false
}

func regionTexts(regions []knowledge.Region) string {
	var b strings.Builder
	for _, r := range regions {
		b.WriteString(r.Text)
		b.WriteString(" | ")
	}
	return b.String()
}

func TestSourceTypeConnectorConstant(t *testing.T) {
	if knowledge.SourceTypeConnector != "connector" {
		t.Fatalf("got %q, want connector", knowledge.SourceTypeConnector)
	}
}

func TestRetrieveScopedManyRanksOnlyWithinScope(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 128}, smallWindows)
	ctx := context.Background()

	apples := strings.Repeat("apples are a sweet red orchard fruit harvested in autumn. ", 20)
	bikes := strings.Repeat("bicycles have two wheels pedals chains and handlebars for riding. ", 20)
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "A", "", apples, nil, 1); err != nil {
		t.Fatalf("add A: %v", err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "B", "", bikes, nil, 1); err != nil {
		t.Fatalf("add B: %v", err)
	}

	// Scope to B only; a query about fruit must still only surface B.
	res, err := k.RetrieveScopedMany(ctx, "p", []string{"tell me about fruit"}, 5,
		[]knowledge.Origin{{SourceType: knowledge.SourceTypeConnector, SourceID: "B"}})
	if err != nil {
		t.Fatalf("scoped retrieve: %v", err)
	}
	if len(res.Regions) == 0 {
		t.Fatal("scoped retrieval returned no regions")
	}
	for _, r := range res.Regions {
		if r.SourceID != "B" {
			t.Fatalf("region leaked from %q; scope was B-only", r.SourceID)
		}
	}

	// Empty allow-set → no regions.
	empty, err := k.RetrieveScopedMany(ctx, "p", []string{"anything"}, 5, nil)
	if err != nil {
		t.Fatalf("empty scope: %v", err)
	}
	if len(empty.Regions) != 0 {
		t.Fatalf("empty scope returned %d regions", len(empty.Regions))
	}

	// An unknown origin contributes nothing (not an error).
	none, err := k.RetrieveScopedMany(ctx, "p", []string{"fruit"}, 5,
		[]knowledge.Origin{{SourceType: knowledge.SourceTypeConnector, SourceID: "ghost"}})
	if err != nil {
		t.Fatalf("unknown origin: %v", err)
	}
	if len(none.Regions) != 0 {
		t.Fatalf("unknown origin returned %d regions", len(none.Regions))
	}
}

// TestSourcesUnderReturnsPrefixMatches proves the lattice enumeration primitive:
// every source whose SourceID starts with the given prefix, and only those.
func TestSourcesUnderReturnsPrefixMatches(t *testing.T) {
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 32}, smallWindows)
	ctx := context.Background()

	for _, id := range []string{"X\x1fa", "X\x1fb", "Y\x1fa"} {
		if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, id, "", "some text content here", nil, 1); err != nil {
			t.Fatalf("add %q: %v", id, err)
		}
	}

	got, err := store.SourcesUnder("p", knowledge.SourceTypeConnector, "X\x1f")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("SourcesUnder = %+v, want 2 origins", got)
	}
	seen := map[string]bool{}
	for _, o := range got {
		if o.SourceType != knowledge.SourceTypeConnector {
			t.Errorf("origin has wrong source type: %+v", o)
		}
		seen[o.SourceID] = true
	}
	if !seen["X\x1fa"] || !seen["X\x1fb"] || seen["Y\x1fa"] {
		t.Fatalf("SourcesUnder = %+v, want exactly {X\\x1fa, X\\x1fb}", got)
	}

	// Prefix matching is literal, not a LIKE-style pattern: a prefix that happens
	// to contain a wildcard metacharacter must not over-match.
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "X%foo", "", "more text content", nil, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "Xbarfoo", "", "other text content", nil, 1); err != nil {
		t.Fatal(err)
	}
	got, err = store.SourcesUnder("p", knowledge.SourceTypeConnector, "X%")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].SourceID != "X%foo" {
		t.Fatalf("SourcesUnder(%q) = %+v, want exactly {X%%foo}", "X%", got)
	}

	// Prefix matching is case-sensitive, matching strings.HasPrefix exactly:
	// "AbC\x1f" must not also match a source starting with "abc\x1f".
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "AbC\x1fone", "", "mixed case content one", nil, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := k.Add(ctx, "p", knowledge.SourceTypeConnector, "abc\x1ftwo", "", "mixed case content two", nil, 1); err != nil {
		t.Fatal(err)
	}
	got, err = store.SourcesUnder("p", knowledge.SourceTypeConnector, "AbC\x1f")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].SourceID != "AbC\x1fone" {
		t.Fatalf("SourcesUnder(%q) = %+v, want exactly {AbC\\x1fone}", "AbC\x1f", got)
	}
}

// A pool over the crossover is not refused — it clusters over the k-NN graph.
// This used to be a refusal (max_pool was a ceiling on the lattice); it is now
// the switch point between the exact and sparse constructions, and no pool is
// ever too large to cluster.
func TestAddClustersAnOversizedPoolSparsely(t *testing.T) {
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.MaxClusterPool = 3
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)

	// Six sentences at a 200-rune window target produce well over three windows.
	text := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta. ", 40)
	res, err := k.Add(context.Background(), "p1", knowledge.SourceTypeDocument, "d1", "Doc", text,
		[]knowledge.BlockSpan{{Start: 0, End: len(text)}}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Windows <= opts.MaxClusterPool {
		t.Fatalf("windows = %d, want more than the %d crossover so the sparse path runs", res.Windows, opts.MaxClusterPool)
	}
	if res.Nodes == 0 {
		t.Error("Nodes = 0, want the sparse ascent to have clustered these near-identical windows")
	}
	hits, err := k.Retrieve(context.Background(), "p1", "alpha beta gamma", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits.Regions) == 0 {
		t.Error("no regions: retrieval must ground against the sparsely clustered windows")
	}
}

// Under the crossover, the exact construction runs, as it always has.
func TestAddClustersNormallyUnderTheBound(t *testing.T) {
	store := knowledge.NewMemoryStore()
	opts := smallWindows
	opts.MaxClusterPool = 1000
	k := knowledge.New(store, fakeEmbedder{dim: 128}, opts)

	text := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta. ", 40)
	res, err := k.Add(context.Background(), "p1", knowledge.SourceTypeDocument, "d1", "Doc", text,
		[]knowledge.BlockSpan{{Start: 0, End: len(text)}}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Nodes == 0 {
		t.Error("Nodes = 0, want the ascent to have clustered these near-identical windows")
	}
}

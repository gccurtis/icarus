package knowledge

import (
	"math"
	"strings"
	"testing"
	"time"
)

func TestSentenceSpans(t *testing.T) {
	text := "First sentence. Second one! Third? Trailing tail"
	spans := sentenceSpans(text)
	if len(spans) != 4 {
		t.Fatalf("got %d sentences: %+v", len(spans), spans)
	}
	// Every byte belongs to exactly one sentence: concatenation reproduces text.
	joined := ""
	for _, s := range spans {
		joined += text[s.start:s.end]
	}
	if joined != text {
		t.Errorf("sentences do not cover the text: %q", joined)
	}
	if text[spans[0].start:spans[0].end] != "First sentence. " {
		t.Errorf("sentence 0 = %q", text[spans[0].start:spans[0].end])
	}
	if text[spans[3].start:spans[3].end] != "Trailing tail" {
		t.Errorf("sentence 3 = %q", text[spans[3].start:spans[3].end])
	}

	// A newline is always a boundary (flatten emits one block per line).
	nl := sentenceSpans("block one line\nblock two line\n")
	if len(nl) != 2 {
		t.Errorf("newline blocks = %+v", nl)
	}

	// An ellipsis run terminates once, at its end.
	el := sentenceSpans("Wait... then go. End")
	if len(el) != 3 {
		t.Errorf("ellipsis = %+v", el)
	}
}

func TestWindowSpansSentenceAware(t *testing.T) {
	// Ten 16-rune sentences; target 40 runes → windows of two sentences (adding a
	// third would exceed the target), overlap of one trailing sentence (16 ≤ 20).
	text := ""
	for i := 0; i < 10; i++ {
		text += "aaaa bbbb cccc. "
	}
	spans := windowSpans(text, 40, 20)
	if len(spans) < 4 {
		t.Fatalf("spans = %+v", spans)
	}
	for i, s := range spans {
		if (s.end-s.start)%16 != 0 {
			t.Errorf("window %d does not cut on a sentence boundary: %+v", i, s)
		}
		if i > 0 && s.start >= spans[i-1].end {
			t.Errorf("windows %d and %d do not overlap: %+v %+v", i-1, i, spans[i-1], s)
		}
		if i > 0 && s.start <= spans[i-1].start {
			t.Errorf("window %d does not progress: %+v %+v", i, spans[i-1], s)
		}
	}
	if spans[len(spans)-1].end != len(text) {
		t.Errorf("last window does not reach the end: %+v", spans[len(spans)-1])
	}

	// A single sentence longer than the target is hard-split rather than emitted
	// oversized.
	long := windowSpans(strings.Repeat("x", 100), 40, 10)
	if len(long) != 3 {
		t.Fatalf("oversized split = %+v", long)
	}
	for _, s := range long {
		if s.end-s.start > 40 {
			t.Errorf("chunk exceeds target: %+v", s)
		}
	}

	// Multibyte text stays on rune boundaries and slices back cleanly.
	multi := "héllo wörld. café ünïcode! ends hére. "
	for _, s := range windowSpans(multi, 5, 2) {
		_ = multi[s.start:s.end] // would panic if a cut landed mid-rune
	}

	if windowSpans("", 40, 10) != nil {
		t.Errorf("empty text should yield no windows")
	}
}

func adjFromEdges(n int, edges [][2]int) [][]bool {
	adj := make([][]bool, n)
	for i := range adj {
		adj[i] = make([]bool, n)
	}
	for _, e := range edges {
		adj[e[0]][e[1]], adj[e[1]][e[0]] = true, true
	}
	return adj
}

// The defining KLR distinction: a chain A–B–C where A and C do not clear the
// threshold must NOT become one cluster (that would be single linkage). Every
// pair inside a cluster must qualify, so the cliques are {A,B} and {B,C}, with B
// a member of both.
func TestMaximalCliquesRejectChain(t *testing.T) {
	cliques := maximalCliques(adjFromEdges(3, [][2]int{{0, 1}, {1, 2}}), 0)
	want := [][]int{{0, 1}, {1, 2}}
	if len(cliques) != 2 {
		t.Fatalf("cliques = %v, want %v", cliques, want)
	}
	for i := range want {
		if len(cliques[i]) != 2 || cliques[i][0] != want[i][0] || cliques[i][1] != want[i][1] {
			t.Errorf("cliques = %v, want %v", cliques, want)
		}
	}
}

func TestMaximalCliquesTriangleAndOverlap(t *testing.T) {
	// A triangle plus a pendant edge sharing vertex 2: the triangle is one
	// maximal clique, the pendant pair another, and vertex 2 belongs to both.
	cliques := maximalCliques(adjFromEdges(4, [][2]int{{0, 1}, {1, 2}, {0, 2}, {2, 3}}), 0)
	if len(cliques) != 2 {
		t.Fatalf("cliques = %v", cliques)
	}
	if len(cliques[0]) != 3 || cliques[0][0] != 0 || cliques[0][1] != 1 || cliques[0][2] != 2 {
		t.Errorf("triangle clique = %v", cliques[0])
	}
	if len(cliques[1]) != 2 || cliques[1][0] != 2 || cliques[1][1] != 3 {
		t.Errorf("pendant clique = %v", cliques[1])
	}
}

func TestMaximalCliquesNoEdges(t *testing.T) {
	if cliques := maximalCliques(adjFromEdges(3, nil), 0); len(cliques) != 0 {
		t.Fatalf("cliques = %v, want none (singletons are not clusters)", cliques)
	}
}

func TestRelativeThreshold(t *testing.T) {
	sims := [][]float64{
		{1, 0.2, 0.4},
		{0.2, 1, 0.8},
		{0.4, 0.8, 1},
	}
	// Off-diagonal distribution sorted: [0.2 0.4 0.8]; percentile 0.75 → index 1.
	if got := relativeThreshold(sims, 0.75, 0.30); got != 0.4 {
		t.Errorf("threshold = %v, want 0.4", got)
	}
	// The floor holds when the distribution runs low.
	if got := relativeThreshold(sims, 0.0, 0.30); got != 0.30 {
		t.Errorf("floored threshold = %v, want 0.30", got)
	}
}

// unit builds a unit vector with the given components.
func unit(components ...float64) []float64 { return normalize(components) }

func testCfg() clusterConfig { return defaultClusterConfig() }

// Two near-identical vectors cluster; the orthogonal third stays an orphan and
// carries upward unchanged — it is never absorbed into a least-bad bucket.
func TestAscendOrphanPassthrough(t *testing.T) {
	ids := []string{"a", "b", "c"}
	vecs := [][]float64{
		unit(1, 0, 0),
		unit(0.99, 0.14, 0),
		unit(0, 0, 1),
	}
	nodes := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, vecs, testCfg(), time.Now()).nodes
	if len(nodes) != 1 {
		t.Fatalf("nodes = %+v, want exactly one cluster", nodes)
	}
	n := nodes[0]
	if n.Count != 2 || len(n.MemberIDs) != 2 || n.MemberIDs[0] != "a" || n.MemberIDs[1] != "b" {
		t.Errorf("cluster members = %+v", n)
	}
	if n.Cohesion < 0.98 {
		t.Errorf("cohesion = %v", n.Cohesion)
	}

	// The frontier is the root plus the orphan window.
	windows := []Window{
		{ID: "a", LocalRefID: "ref"}, {ID: "b", LocalRefID: "ref"}, {ID: "c", LocalRefID: "ref", Embedding: vecs[2]},
	}
	frontier := sourceFrontier(nodes, windows)
	if len(frontier) != 2 || frontier[0].ID != n.ID || frontier[1].ID != "c" || !frontier[1].IsWindow {
		t.Errorf("frontier = %+v", frontier)
	}
}

// Two tight, mutually orthogonal groups end as a forest of two roots — never a
// forced single summary root over unrelated topics.
func TestAscendEndsAsForest(t *testing.T) {
	ids := []string{"a1", "a2", "b1", "b2"}
	vecs := [][]float64{
		unit(1, 0, 0, 0), unit(0.99, 0.14, 0, 0),
		unit(0, 0, 1, 0), unit(0, 0, 0.99, 0.14),
	}
	nodes := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, vecs, testCfg(), time.Now()).nodes
	if len(nodes) != 2 {
		t.Fatalf("nodes = %+v, want two clusters and no super-root", nodes)
	}
	for _, n := range nodes {
		if n.Level != 1 || n.Count != 2 {
			t.Errorf("node = %+v", n)
		}
	}
}

// Identical vectors converge to a single root with full cohesion.
func TestAscendConvergesWhenCohesive(t *testing.T) {
	ids := []string{"a", "b", "c"}
	v := unit(1, 2, 3)
	nodes := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, [][]float64{v, v, v}, testCfg(), time.Now()).nodes
	if len(nodes) != 1 {
		t.Fatalf("nodes = %+v", nodes)
	}
	if nodes[0].Count != 3 || nodes[0].Cohesion < 0.999 {
		t.Errorf("root = %+v", nodes[0])
	}
}

// A 4-cycle threshold graph (each vector shares one axis with each neighbor,
// none with its opposite) yields four overlapping pair-cliques — a pool that
// does not shrink. The progress guard must stop the ascent instead of looping.
func TestAscendProgressGuard(t *testing.T) {
	ids := []string{"v0", "v1", "v2", "v3"}
	vecs := [][]float64{
		unit(1, 1, 0, 0), unit(0, 1, 1, 0), unit(0, 0, 1, 1), unit(1, 0, 0, 1),
	}
	done := make(chan []Node)
	go func() {
		nodes := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, vecs, testCfg(), time.Now()).nodes
		done <- nodes
	}()
	select {
	case nodes := <-done:
		for _, n := range nodes {
			if n.Level != 1 {
				t.Errorf("expected only level-1 nodes, got %+v", n)
			}
		}
	case <-time.After(5 * time.Second):
		t.Fatal("ascend did not terminate")
	}
}

// The clustering is deterministic: the same input produces the same structure
// (sizes, levels, memberships), run after run.
func TestAscendDeterministic(t *testing.T) {
	ids := []string{"a", "b", "c", "d", "e"}
	vecs := [][]float64{
		unit(1, 0, 0), unit(0.95, 0.31, 0), unit(0.9, 0.43, 0),
		unit(0, 1, 0), unit(0, 0.95, 0.31),
	}
	shape := func(nodes []Node) [][2]int {
		var out [][2]int
		for _, n := range nodes {
			out = append(out, [2]int{n.Level, n.Count})
		}
		return out
	}
	a := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, vecs, testCfg(), time.Now()).nodes
	b := ascend(ascentScope{projectID: "p", localRefID: "ref"}, ids, vecs, testCfg(), time.Now()).nodes
	sa, sb := shape(a), shape(b)
	if len(sa) != len(sb) {
		t.Fatalf("shapes differ: %v vs %v", sa, sb)
	}
	for i := range sa {
		if sa[i] != sb[i] {
			t.Errorf("shapes differ at %d: %v vs %v", i, sa[i], sb[i])
		}
	}
	// Ids too, not just shape. A node is content-addressed from its member set, so
	// the same clique found twice is the same node — and two runs over identical
	// input must be indistinguishable, timestamps included.
	for i := range a {
		if a[i].ID != b[i].ID {
			t.Errorf("node %d got different ids across runs: %s vs %s", i, a[i].ID, b[i].ID)
		}
	}
}

// A node's id is its member SET, so the order members are discovered in must not
// change it — while the stored MemberIDs order, which membership edges are
// written in, is preserved as given.
func TestNodeIDIsOrderIndependentOverMembers(t *testing.T) {
	forward := nodeID("p", "ref", 1, []string{"w1", "w2", "w3"})
	shuffled := nodeID("p", "ref", 1, []string{"w3", "w1", "w2"})
	if forward != shuffled {
		t.Errorf("member order changed the id: %s vs %s", forward, shuffled)
	}
	// Everything else in the address must separate.
	for name, other := range map[string]string{
		"project":    nodeID("other", "ref", 1, []string{"w1", "w2", "w3"}),
		"local ref":  nodeID("p", "other", 1, []string{"w1", "w2", "w3"}),
		"level":      nodeID("p", "ref", 2, []string{"w1", "w2", "w3"}),
		"member set": nodeID("p", "ref", 1, []string{"w1", "w2", "w4"}),
	} {
		if other == forward {
			t.Errorf("a different %s produced the same id", name)
		}
	}
}

// Length-prefixing the fields is what stops one field's bytes from being read as
// another's: without it ("ab","c") and ("a","bc") hash alike.
func TestNodeIDFieldsCannotRunTogether(t *testing.T) {
	if nodeID("ab", "c", 1, nil) == nodeID("a", "bc", 1, nil) {
		t.Error("field boundaries are ambiguous; a project/ref split collides")
	}
	if nodeID("p", "ref", 1, []string{"ab", "c"}) == nodeID("p", "ref", 1, []string{"a", "bc"}) {
		t.Error("member boundaries are ambiguous")
	}
}

func TestCentroidIsNormalizedSum(t *testing.T) {
	c := centroid([][]float64{unit(1, 0), unit(0, 1)})
	want := 1 / math.Sqrt2
	if math.Abs(c[0]-want) > 1e-9 || math.Abs(c[1]-want) > 1e-9 {
		t.Errorf("centroid = %v", c)
	}
}

// Every window must carry content. A window whose slice is empty or only
// whitespace has nothing to embed, and sending one is not harmless: OpenRouter
// rejects a batch containing an empty string with HTTP 200 and an empty data
// array, so ONE blank window silently zeroes the embeddings for every window
// beside it. This surfaced only when the shipped embedding model replaced a
// more permissive one — the blank window had been there all along.
func TestWindowSpansNeverEmitAnEmptyOrBlankWindow(t *testing.T) {
	for _, text := range []string{
		"",
		"   ",
		"\n\n\n",
		"A short line.\n",
		"First sentence. Second sentence.\n\n\n",
		"   \n  Leading blanks. Then more text here.  \n\n",
		strings.Repeat("Sentence number one. ", 40),
	} {
		for _, target := range []int{1, 20, 200, 4000} {
			spans := windowSpans(text, target, target/10)
			for _, s := range spans {
				if s.start < 0 || s.end > len(text) || s.start > s.end {
					t.Fatalf("text %q target %d: span out of range %+v", text, target, s)
				}
				if strings.TrimSpace(text[s.start:s.end]) == "" {
					t.Fatalf("text %q target %d: emitted a blank window %+v", text, target, s)
				}
			}
		}
	}
}

// The abort cap stops enumeration once the result is already destined for
// rejection. A complete graph on n vertices has exactly one maximal clique, so a
// graph that explodes needs overlapping cliques: a "cocktail party" graph (every
// vertex adjacent to all but its partner) has 2^(n/2) maximal cliques — 1024 at
// n=20, and growing without bound.
func TestMaximalCliquesAbortsOnExplosion(t *testing.T) {
	const n = 20
	adj := make([][]bool, n)
	for i := range adj {
		adj[i] = make([]bool, n)
	}
	for i := range n {
		for j := range n {
			if i != j && i^1 != j { // not self, not partner
				adj[i][j] = true
			}
		}
	}

	// Uncapped, this enumerates 2^10 = 1024 cliques.
	full := maximalCliques(adj, 0)
	if len(full) != 1024 {
		t.Fatalf("uncapped enumeration = %d cliques, want 1024 (the explosion this guards)", len(full))
	}

	// Capped at n, it abandons the search early rather than enumerating them all.
	capped := maximalCliques(adj, n)
	if len(capped) > len(full) {
		t.Errorf("capped run produced more cliques (%d) than uncapped (%d)", len(capped), len(full))
	}
	if len(capped) >= 1024 {
		t.Errorf("cap did not abort: got %d cliques", len(capped))
	}
	// buildLevel rejects anything over n, so an aborted run only has to exceed n to
	// reach the same verdict the full enumeration would have.
	if len(capped) <= n {
		t.Errorf("aborted at %d cliques, which is <= n=%d — buildLevel would wrongly accept it", len(capped), n)
	}
}

// An accepted level is bit-for-bit what the uncapped enumeration would produce.
// buildLevel only accepts a count <= n, so an accepted run never reached the cap
// — the abort can shorten a rejected attempt but can never change an answer.
func TestCappedEnumerationMatchesUncappedWhenAccepted(t *testing.T) {
	adj := adjFromEdges(4, [][2]int{{0, 1}, {1, 2}, {0, 2}, {2, 3}})
	full := maximalCliques(adj, 0)
	capped := maximalCliques(adj, len(adj))
	if len(full) != len(capped) {
		t.Fatalf("capped = %v, uncapped = %v", capped, full)
	}
	for i := range full {
		if len(full[i]) != len(capped[i]) {
			t.Fatalf("clique %d differs: %v vs %v", i, capped[i], full[i])
		}
		for j := range full[i] {
			if full[i][j] != capped[i][j] {
				t.Fatalf("clique %d differs: %v vs %v", i, capped[i], full[i])
			}
		}
	}
}

// sortedOffDiagonal is the distribution relativeThreshold reads, hoisted so
// buildLevel builds it once. Querying it at rising percentiles must give exactly
// what a fresh relativeThreshold call would.
func TestPercentileOfMatchesRelativeThreshold(t *testing.T) {
	sims := [][]float64{
		{1, 0.2, 0.4, 0.9},
		{0.2, 1, 0.8, 0.15},
		{0.4, 0.8, 1, 0.55},
		{0.9, 0.15, 0.55, 1},
	}
	sorted := sortedOffDiagonal(sims)
	if len(sorted) != 6 {
		t.Fatalf("off-diagonal count = %d, want 6", len(sorted))
	}
	for i := 1; i < len(sorted); i++ {
		if sorted[i] < sorted[i-1] {
			t.Fatalf("not ascending: %v", sorted)
		}
	}
	// The percentiles buildLevel actually walks: 0.75, then p += (1-p)/2.
	p := 0.75
	for range 8 {
		want := relativeThreshold(sims, p, 0.30)
		if got := percentileOf(sorted, p, 0.30); got != want {
			t.Errorf("percentile %v: hoisted = %v, fresh = %v", p, got, want)
		}
		p += (1 - p) / 2
	}
}

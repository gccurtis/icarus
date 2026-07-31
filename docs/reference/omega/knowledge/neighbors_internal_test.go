package knowledge

import (
	"fmt"
	"math"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"
)

// The sparse clique enumeration must agree exactly with the dense one — same
// cliques, same canonical order — because the sparse path's claim is that the
// KLR rule is untouched, and this is the half of the rule where a subtle
// divergence would hide. Random graphs across the density range are the
// harshest cheap comparison available: the set of maximal cliques is unique,
// so any disagreement is a bug in one of the two.
func TestSparseCliquesMatchDense(t *testing.T) {
	rng := newXorshift(42)
	for _, n := range []int{2, 8, 20, 40} {
		for _, density := range []float64{0.05, 0.2, 0.5, 0.8} {
			adj := make([][]bool, n)
			for i := range adj {
				adj[i] = make([]bool, n)
			}
			lists := make([][]int, n)
			for i := 0; i < n; i++ {
				for j := i + 1; j < n; j++ {
					if float64(rng.next()%1000)/1000 < density {
						adj[i][j], adj[j][i] = true, true
						lists[i] = append(lists[i], j)
						lists[j] = append(lists[j], i)
					}
				}
			}
			dense := maximalCliques(adj, 0)
			sparse := maximalCliquesSparse(lists, 0)
			if !reflect.DeepEqual(dense, sparse) {
				t.Errorf("n=%d density=%.2f: dense found %d cliques, sparse found %d — the enumerations disagree",
					n, density, len(dense), len(sparse))
			}
		}
	}
}

// The graph's structural contract: symmetric, self-free, sorted — and every
// stored similarity is the exact full-dimension dot product. Approximation may
// only ever decide WHICH pairs get scored, never what a score is.
func TestNeighborGraphIsSymmetricAndExact(t *testing.T) {
	vecs := clusteredVectors(240, 64, 8)
	g := buildNeighborGraph(vecs, knnConfig{k: 8, pcaDims: 16})
	edges := 0
	for i, es := range g {
		for n, e := range es {
			edges++
			if e.to == i {
				t.Fatalf("vertex %d lists itself", i)
			}
			if n > 0 && es[n-1].to >= e.to {
				t.Fatalf("vertex %d adjacency is not strictly ascending", i)
			}
			if want := dot(vecs[i], vecs[e.to]); e.sim != want {
				t.Fatalf("edge (%d,%d) sim %v, want the exact dot %v", i, e.to, e.sim, want)
			}
			back := false
			for _, r := range g[e.to] {
				if r.to == i && r.sim == e.sim {
					back = true
				}
			}
			if !back {
				t.Fatalf("edge (%d,%d) has no identical reverse edge", i, e.to)
			}
		}
	}
	if edges == 0 {
		t.Fatal("the graph came back empty; nothing above was tested")
	}
}

// The construction is only useful if it finds the TRUE neighbours. Against
// brute force on a clustered fixture, the graph must recover nearly all of
// each vertex's exact top-k — this is the number that justifies trusting
// candidates from a projected, cell-limited search.
func TestNeighborGraphRecall(t *testing.T) {
	const n, k = 240, 8
	vecs := clusteredVectors(n, 64, 8)
	g := buildNeighborGraph(vecs, knnConfig{k: k, pcaDims: 16})
	hits, want := 0, 0
	for i := range vecs {
		type scored struct {
			idx int
			sim float64
		}
		all := make([]scored, 0, n-1)
		for j := range vecs {
			if j != i {
				all = append(all, scored{idx: j, sim: dot(vecs[i], vecs[j])})
			}
		}
		sort.Slice(all, func(a, b int) bool {
			if all[a].sim != all[b].sim {
				return all[a].sim > all[b].sim
			}
			return all[a].idx < all[b].idx
		})
		for _, s := range all[:k] {
			want++
			for _, e := range g[i] {
				if e.to == s.idx {
					hits++
					break
				}
			}
		}
	}
	recall := float64(hits) / float64(want)
	t.Logf("graph recall of exact top-%d: %.3f (%d of %d)", k, recall, hits, want)
	if recall < 0.9 {
		t.Errorf("recall %.3f is below 0.9 — the candidate search is missing true neighbours", recall)
	}
}

// With no projection, one cell and k at least the pool size, nothing is
// approximated away — and the pool is small enough that the threshold sample
// is every pair. The sparse level must then reproduce the exact level bit for
// bit: same threshold, same cliques. This pins the two paths to one semantics
// on the ground where they overlap.
func TestSparseLevelMatchesExactWhenComplete(t *testing.T) {
	const n = 120
	vecs := clusteredVectors(n, 64, 6)
	cfg := defaultClusterConfig()
	cfg.neighbors = knnConfig{k: n, cells: 1, pcaDims: 0}
	exact := buildLevel(pairwise(vecs), cfg)
	sparse := buildLevelIndex(nil, vecs, cfg).cluster(vecs)
	if exact.threshold != sparse.threshold {
		t.Errorf("thresholds differ: exact %v, sparse %v", exact.threshold, sparse.threshold)
	}
	if !reflect.DeepEqual(exact.cliques, sparse.cliques) {
		t.Errorf("cliques differ: exact found %d, sparse found %d", len(exact.cliques), len(sparse.cliques))
	}
	if len(exact.cliques) == 0 {
		t.Error("the exact level found no cliques; the comparison proved nothing")
	}
}

// The fitted basis must be orthonormal, because everything the projection
// claims — that projected dots approximate full dots — rests on it.
func TestProjectionBasisIsOrthonormal(t *testing.T) {
	vecs := clusteredVectors(300, 96, 5)
	q := fitProjection(vecs, 24, newXorshift(7))
	if q == nil {
		t.Fatal("expected a projection for 96 -> 24 dims")
	}
	for i := range q {
		for j := i; j < len(q); j++ {
			got := dot(q[i], q[j])
			want := 0.0
			if i == j {
				want = 1
			}
			if math.Abs(got-want) > 1e-9 {
				t.Fatalf("q[%d]·q[%d] = %v, want %v — the basis is not orthonormal", i, j, got, want)
			}
		}
	}
}

// The recall harness — the number that decides whether the sparse path may be
// enabled, and later whether k is set right. Both ascents run over the same
// clustered fixture; node ids are content-addressed from member sets, so "the
// sparse path found the same cluster" is literally an id match, no structural
// diffing required.
//
// Groups are sized BELOW k on purpose. A natural cluster larger than k turns
// its own neighbourhood into a near-complete graph with holes — the worst
// case for clique enumeration — and fragments into overlapping sub-cliques by
// design (k caps cluster size). That regime is a known trade the live
// validation gate prices; this harness measures the regime the design
// targets, where the sparse path claims to reproduce the exact one.
func TestSparseAscendRecoversExactClusters(t *testing.T) {
	const n, dim, groups = 1200, 256, 60 // groups of 20, under k=32
	vecs := clusteredVectors(n, dim, groups)
	leafIDs := ids(n)
	now := time.Now()

	exactCfg := defaultClusterConfig()
	exactCfg.maxPool = n // the whole pool fits, so every level is exact
	exact := ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, exactCfg, now).nodes

	sparseCfg := defaultClusterConfig()
	sparseCfg.maxPool = 100 // far below the pool, so level 1 must go sparse
	sparseCfg.neighbors = knnConfig{k: 32, pcaDims: 64}
	sparse := ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, sparseCfg, now).nodes

	level1 := func(nodes []Node) map[string]bool {
		out := map[string]bool{}
		for _, nd := range nodes {
			if nd.Level == 1 {
				out[nd.ID] = true
			}
		}
		return out
	}
	e1, s1 := level1(exact), level1(sparse)
	if len(e1) == 0 {
		t.Fatal("the exact ascent formed no level-1 clusters; the harness proves nothing")
	}
	shared := 0
	for id := range e1 {
		if s1[id] {
			shared++
		}
	}
	recall := float64(shared) / float64(len(e1))
	t.Logf("sparse path recovered %d of %d exact level-1 clusters (recall %.3f); it formed %d", shared, len(e1), recall, len(s1))
	if recall < 0.9 {
		t.Errorf("cluster recall %.3f is below 0.9 — the sparse path is losing clusters the exact path finds", recall)
	}

	// And the sparse ascent must be a pure function of its inputs, end to end:
	// same pool, same nodes, same ids.
	again := ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, sparseCfg, now).nodes
	rerun := level1(again)
	if !reflect.DeepEqual(s1, rerun) {
		t.Error("two sparse ascents over the same pool produced different level-1 clusters")
	}
}

// The fallback for clusters larger than k must keep the clique guarantee it
// claims: every pair inside an emitted cluster clears the threshold, no
// cluster mixes groups, and the same pool produces the same clusters twice.
func TestGreedyNeighborhoodClustersAreVerified(t *testing.T) {
	const n, groups, k = 300, 3, 16 // groups of 100, far over k
	vecs := clusteredVectors(n, 64, groups)
	nbrs := buildNeighborGraph(vecs, knnConfig{k: k, pcaDims: 16})
	const threshold = 0.5
	clusters := greedyNeighborhoodClusters(vecs, nbrs, threshold)
	if len(clusters) == 0 {
		t.Fatal("no clusters formed over a strongly clustered pool")
	}
	covered := 0
	for _, c := range clusters {
		covered += len(c)
		for i := 0; i < len(c); i++ {
			if c[i]%groups != c[0]%groups {
				t.Fatalf("cluster %v mixes groups — members are not mutually similar", c)
			}
			for j := i + 1; j < len(c); j++ {
				if s := dot(vecs[c[i]], vecs[c[j]]); s < threshold {
					t.Fatalf("pair (%d,%d) in a cluster has similarity %.3f, below the %v threshold the cluster claims", c[i], c[j], s, threshold)
				}
			}
		}
	}
	if covered < n/2 {
		t.Errorf("only %d of %d vertices joined any cluster; the fallback is leaving a clustered pool unclustered", covered, n)
	}
	again := greedyNeighborhoodClusters(vecs, nbrs, threshold)
	if !reflect.DeepEqual(clusters, again) {
		t.Error("the same pool produced two different fallback clusterings")
	}
}

// A cluster larger than k cannot be one clique in a k-NN graph — k caps
// cluster size, so level 1 shatters it into fragments. The design's answer is
// that the hierarchy repairs the shatter upstairs: the fragments' centroids
// are near-identical, so higher levels clique them back together. This test
// holds that claim to a number: after a sparse ascent over groups of 100 with
// k=16, some node must reassemble (nearly) each group, and no node may mix
// groups.
func TestOverKClustersReassembleUpTheLattice(t *testing.T) {
	const n, dim, groups, k = 600, 64, 6, 16
	vecs := clusteredVectors(n, dim, groups)
	leafIDs := ids(n)
	cfg := defaultClusterConfig()
	cfg.maxPool = 50 // force the sparse path while the pool is of any size
	cfg.neighbors = knnConfig{k: k, pcaDims: 16}
	nodes := ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, cfg, time.Now()).nodes
	if len(nodes) == 0 {
		t.Fatal("no nodes formed at all")
	}

	// The leaf windows each node covers, transitively.
	byID := map[string]Node{}
	for _, nd := range nodes {
		byID[nd.ID] = nd
	}
	var leaves func(id string, into map[string]bool)
	leaves = func(id string, into map[string]bool) {
		nd, isNode := byID[id]
		if !isNode {
			into[id] = true
			return
		}
		for _, m := range nd.MemberIDs {
			leaves(m, into)
		}
	}

	group := func(leafID string) int {
		var idx int
		fmt.Sscanf(leafID, "id-%d", &idx)
		return idx % groups
	}
	bestF1 := make([]float64, groups)
	for _, nd := range nodes {
		got := map[string]bool{}
		leaves(nd.ID, got)
		counts := make([]int, groups)
		for leaf := range got {
			counts[group(leaf)]++
		}
		for g, c := range counts {
			if c > 0 && c < len(got) {
				// Mixed-group nodes would mean between-group similarity cleared
				// a threshold, which the fixture makes impossible.
				t.Fatalf("node %s mixes groups: %d of %d leaves from group %d", nd.ID, c, len(got), g)
			}
		}
		g := group(first(got))
		precision := 1.0 // no node mixes groups, per the check above
		recall := float64(len(got)) / float64(n/groups)
		f1 := 2 * precision * recall / (precision + recall)
		if f1 > bestF1[g] {
			bestF1[g] = f1
		}
	}
	for g, f1 := range bestF1 {
		t.Logf("group %d: best node F1 %.3f", g, f1)
		if f1 < 0.9 {
			t.Errorf("group %d: best node reassembles only F1 %.3f of the group — the hierarchy is not repairing the k-cap shatter", g, f1)
		}
	}
}

func first(set map[string]bool) string {
	for s := range set {
		return s
	}
	return ""
}

// The equivalence gate for repair: an index maintained through local events —
// inserts and removals against pinned structure — must match what a full
// rebuild would produce over the same final pool. In the target regime
// (groups under k) the agreement must be essentially total: every true
// neighbourhood is fully visible to both constructions, so same edges, same
// clusters, same content-addressed identity.
func TestRepairedIndexMatchesRebuilt(t *testing.T) {
	// dim 256, not 64: with 40 random group centres in 64 dimensions the
	// centres themselves correlate enough that cross-group similarities leak
	// past the 0.30 floor, and the "true" structure is genuinely messy — a
	// fixture problem, not a repair problem. At 256 the groups separate.
	const n, dim, groups, k = 800, 256, 40, 32 // groups of 20, under k
	const initial, removals = 700, 50
	all := clusteredVectors(n, dim, groups)
	allIDs := ids(n)
	cfg := defaultClusterConfig()
	cfg.neighbors = knnConfig{k: k, pcaDims: 16}

	// The repaired index: built over the first 700, then 50 originals removed
	// and the last 100 inserted — the shape of a connector re-sync.
	idx := buildLevelIndex(allIDs[:initial], all[:initial], cfg)
	pool := append([][]float64(nil), all[:initial]...)
	vecAt := func(p int) []float64 { return pool[p] }
	removed := map[int]bool{}
	for i := 0; i < removals; i++ {
		at := i * 14 // spread across the pool
		removed[at] = true
		if !idx.remove(allIDs[at]) {
			t.Fatalf("remove(%s) found no live member", allIDs[at])
		}
		pool[at] = nil
	}
	for i := initial; i < n; i++ {
		pool = append(pool, all[i])
		idx.insert(allIDs[i], all[i], vecAt)
	}

	// The fresh index: a full build over the same final pool.
	var freshIDs []string
	var fresh [][]float64
	for i := 0; i < n; i++ {
		if i < initial && removed[i] {
			continue
		}
		freshIDs = append(freshIDs, allIDs[i])
		fresh = append(fresh, all[i])
	}
	freshIdx := buildLevelIndex(freshIDs, fresh, cfg)

	// Edges compared by ID PAIR, because positions differ (tombstones and
	// appends on one side, compaction on the other) — and only edges at or
	// above the index's own pinned threshold, because a vertex's spare
	// below-threshold slots are edges clustering never reads, and the two
	// constructions legitimately fill them differently.
	edgeSet := func(x *levelIndex) map[[2]string]bool {
		out := map[[2]string]bool{}
		for p, es := range x.edges {
			for _, e := range es {
				if e.sim < x.threshold {
					continue
				}
				a, b := x.ids[p], x.ids[e.to]
				if a > b {
					a, b = b, a
				}
				out[[2]string{a, b}] = true
			}
		}
		return out
	}
	rep, frs := edgeSet(idx), edgeSet(freshIdx)
	inter := 0
	for e := range rep {
		if frs[e] {
			inter++
		}
	}
	union := len(rep) + len(frs) - inter
	jaccard := float64(inter) / float64(union)
	t.Logf("edge sets: repaired %d, fresh %d, intersection %d of union %d (Jaccard %.4f)", len(rep), len(frs), inter, union, jaccard)
	if jaccard < 0.98 {
		t.Errorf("edge-set Jaccard %.4f below 0.98 — repair is drifting from what a rebuild would produce", jaccard)
	}

	// Clusters compared as id sets: in this regime they must be identical.
	cliqueSet := func(x *levelIndex, vecs [][]float64) map[string]bool {
		out := map[string]bool{}
		for _, c := range x.cluster(vecs).cliques {
			ms := make([]string, len(c))
			for i, p := range c {
				ms[i] = x.ids[p]
			}
			sort.Strings(ms)
			out[strings.Join(ms, "|")] = true
		}
		return out
	}
	repC, frsC := cliqueSet(idx, pool), cliqueSet(freshIdx, fresh)
	if !reflect.DeepEqual(repC, frsC) {
		t.Errorf("clusters differ: repaired found %d, fresh found %d", len(repC), len(frsC))
	}
	if len(frsC) == 0 {
		t.Error("the fresh build found no clusters; the comparison proved nothing")
	}

	// The pinned threshold must still be honest for this pool: adding and
	// removing a small slice of a stable corpus should barely move the
	// distribution.
	liveVecs := fresh
	if d := idx.drift(liveVecs, cfg); d > 0.02 {
		t.Errorf("drift %.4f after a small delta — the pin is moving more than the pool did", d)
	}

	// And the whole repair sequence must be deterministic.
	again := buildLevelIndex(allIDs[:initial], all[:initial], cfg)
	pool2 := append([][]float64(nil), all[:initial]...)
	for i := 0; i < removals; i++ {
		again.remove(allIDs[i*14])
		pool2[i*14] = nil
	}
	for i := initial; i < n; i++ {
		pool2 = append(pool2, all[i])
		again.insert(allIDs[i], all[i], func(p int) []float64 { return pool2[p] })
	}
	if !reflect.DeepEqual(idx.edges, again.edges) {
		t.Error("the same repair sequence produced two different indexes")
	}
}

// Two builds over the same pool must be identical. Node ids are
// content-addressed downstream, so any nondeterminism here surfaces as id
// churn on every rebuild — precisely what record 0140 removed.
func TestNeighborGraphDeterministic(t *testing.T) {
	vecs := clusteredVectors(200, 64, 8)
	a := buildNeighborGraph(vecs, knnConfig{k: 8, pcaDims: 16})
	b := buildNeighborGraph(vecs, knnConfig{k: 8, pcaDims: 16})
	if !reflect.DeepEqual(a, b) {
		t.Fatal("the same pool produced two different graphs")
	}
}

package knowledge

// neighbors.go builds the k-nearest-neighbour graph the sparse clustering path
// runs on: for each artifact, its k most similar peers with EXACT similarities,
// found without ever materializing the complete pairwise matrix.
//
// The complete matrix is the scaling wall: n²·8 bytes and n²/2 dot products,
// independent of vector dimension (record 0137 measured it — 458MB and 7.8s at
// n=4,000, so 320GB and hours at the 200,000-artifact target). The k-NN graph
// is the same information pruned to what clustering actually reads: clique
// members must be pairwise similar, so every edge a clique needs sits near the
// top of somebody's neighbour list.
//
// The construction is IVF (inverted-file) search over a low-dimensional
// projection:
//
//  1. fit a d-dim orthonormal basis over the pool's dominant directions
//     (uncentered PCA, subspace iteration on a sample);
//  2. project every vector — projections are an index, never a stored
//     similarity;
//  3. k-means the projections into ~√n cells;
//  4. per vertex, score the members of its nearest few cells in projected
//     space and keep a rerank pool of the best;
//  5. rerank that pool with full-dimension exact dot products, keep the top k;
//  6. symmetrize.
//
// Approximation therefore lives ONLY in which candidates get considered
// (steps 1–4). Every similarity that survives into the graph is an exact
// full-dimension dot product — the same number pairwise would have produced
// for that pair.
//
// Everything here is deterministic: fixed seeds, stride sampling, total-order
// tie-breaks, no clock and no global rand. Node ids are content-addressed
// (record 0140), so any nondeterminism in clustering becomes id churn.

import (
	"math"
	"sort"
)

// knnConfig configures the k-NN graph construction. It rides on clusterConfig.
// There is no on/off switch: a pool over maxPool clusters sparsely, full stop.
// Mechanics do not carry flags here — the system runs what is most efficient
// at each scale, and comparisons against other constructions live in tests
// (the differential oracles below) or across git history, not in production
// configuration.
type knnConfig struct {
	// k is how many neighbours each artifact keeps. It also caps how large a
	// clique can grow — a clique is mutual, so no cluster can exceed the degree
	// its members are allowed. That trade is deliberate: hundreds of artifacts
	// all pairwise-similar above threshold is a redundancy statement, not a
	// structure retrieval needs at full size.
	k int
	// cells is the IVF cell count; 0 derives √n, which balances cell scan cost
	// against candidate volume.
	cells int
	// pcaDims is the projection dimension for candidate generation; 0 disables
	// projection, so candidates are scored at full dimension.
	pcaDims int
	// repairMaxFraction bounds the changed fraction (inserts + removes over
	// the pool) a stored index may absorb as a repair; past it the level is
	// rebuilt in full. Non-positive disables repair entirely.
	repairMaxFraction float64
	// repairMaxDrift bounds how far the pinned threshold may sit from the
	// pool's current percentile before a repair is refused and the level
	// consolidates — the "local events stop being honest" line.
	repairMaxDrift float64
}

const (
	defaultNeighborK         = 32
	defaultNeighborPCADims   = 128
	defaultRepairMaxFraction = 0.2
	defaultRepairMaxDrift    = 0.02
)

func defaultKNNConfig() knnConfig {
	return knnConfig{
		k: defaultNeighborK, pcaDims: defaultNeighborPCADims,
		repairMaxFraction: defaultRepairMaxFraction, repairMaxDrift: defaultRepairMaxDrift,
	}
}

const (
	// projectionSampleMax bounds how many vectors the projection is fitted on.
	// The basis only guides candidate search, and the dominant directions of an
	// embedding pool are visible in a modest sample; fitting on everything would
	// make the fit itself quadratic-feeling for no recall anyone can measure.
	projectionSampleMax = 1000
	// projectionIterations is the subspace-iteration count. Each round costs
	// 2·sample·dims·d multiplies; a handful is plenty for a basis that ranks
	// candidates rather than reconstructs vectors.
	projectionIterations = 4
	// kmeansIterations bounds Lloyd's algorithm; it also stops early once no
	// assignment moves.
	kmeansIterations = 8
	// probeCells is how many IVF cells — a vertex's own plus its nearest — feed
	// its candidate pool. With √n cells this yields ~probe·√n candidates.
	probeCells = 4
	// thresholdSampleBudget is how many exact pair similarities the sparse path
	// draws to estimate a level's percentile threshold. At or below the budget
	// every pair is used and the distribution is exact, which is also what pins
	// the sparse path to the exact one in tests.
	thresholdSampleBudget = 200_000
)

// The seeds are arbitrary fixed constants; their value matters only in that it
// never changes. Two, so the projection and the threshold sample are
// independent draws.
const (
	projectionSeed uint64 = 0x9E3779B97F4A7C15
	thresholdSeed  uint64 = 0xD1B54A32D192ED03
)

// xorshift is a tiny deterministic generator (xorshift64). The graph build
// must be a pure function of its inputs, so nothing in this file may read
// global rand or the clock.
type xorshift uint64

func newXorshift(seed uint64) *xorshift {
	if seed == 0 {
		seed = 1
	}
	x := xorshift(seed)
	return &x
}

func (x *xorshift) next() uint64 {
	v := uint64(*x)
	v ^= v << 13
	v ^= v >> 7
	v ^= v << 17
	*x = xorshift(v)
	return v
}

// symmetric returns a uniform value in [-1, 1).
func (x *xorshift) symmetric() float64 {
	return float64(x.next()%2000)/1000 - 1
}

// intn returns a uniform int in [0, n).
func (x *xorshift) intn(n int) int {
	return int(x.next() % uint64(n))
}

// fitProjection returns a d-row orthonormal basis over the pool's dominant
// directions — uncentered PCA, by subspace iteration on a stride sample.
// Uncentered is deliberate: the projection exists to approximate dot products,
// and it is the top singular subspace of the raw vectors, not of the
// mean-centred ones, that preserves x·y best. nil means "no projection" — the
// pool's dimension is already at or below d.
func fitProjection(vecs [][]float64, d int, rng *xorshift) [][]float64 {
	if len(vecs) == 0 {
		return nil
	}
	dim := len(vecs[0])
	if d <= 0 || d >= dim {
		return nil
	}
	sample := vecs
	if len(vecs) > projectionSampleMax {
		sample = make([][]float64, projectionSampleMax)
		for i := range sample {
			sample[i] = vecs[i*len(vecs)/projectionSampleMax]
		}
	}
	q := make([][]float64, d)
	for j := range q {
		row := make([]float64, dim)
		for t := range row {
			row[t] = rng.symmetric()
		}
		q[j] = row
	}
	orthonormalize(q, rng)
	for it := 0; it < projectionIterations; it++ {
		// z_j = Σ_i x_i·(x_i·q_j) — one pass of X'X without forming X'X, which
		// would cost sample·dim² against this loop's sample·dim·d.
		z := make([][]float64, d)
		for j := range z {
			z[j] = make([]float64, dim)
		}
		for _, x := range sample {
			for j := range q {
				c := dot(x, q[j])
				row := z[j]
				for t, xv := range x {
					row[t] += c * xv
				}
			}
		}
		q = z
		orthonormalize(q, rng)
	}
	return q
}

// orthonormalize runs modified Gram–Schmidt over the rows in place. A row that
// collapses (the sample has less rank than we asked dimensions) is re-seeded
// from the generator and re-orthogonalized, so the result is always a full
// orthonormal set and still deterministic.
func orthonormalize(q [][]float64, rng *xorshift) {
	for j := range q {
		projectOut := func() {
			for i := 0; i < j; i++ {
				c := dot(q[j], q[i])
				for t := range q[j] {
					q[j][t] -= c * q[i][t]
				}
			}
		}
		projectOut()
		n := math.Sqrt(dot(q[j], q[j]))
		for n < 1e-9 {
			for t := range q[j] {
				q[j][t] = rng.symmetric()
			}
			projectOut()
			n = math.Sqrt(dot(q[j], q[j]))
		}
		inv := 1 / n
		for t := range q[j] {
			q[j][t] *= inv
		}
	}
}

// project maps one vector through the basis: out_j = q_j·x. With orthonormal
// rows, dot products of projections approximate dot products of the originals
// to the extent the originals live in the fitted subspace.
func project(q [][]float64, x []float64) []float64 {
	out := make([]float64, len(q))
	for j, row := range q {
		out[j] = dot(row, x)
	}
	return out
}

// kmeansCells partitions the (projected) vectors into cells — the IVF coarse
// quantizer. Initialization is a deterministic stride over the pool, empty
// cells keep their previous centroid, and iteration stops early once no
// assignment moves.
func kmeansCells(pts [][]float64, cells int) (centroids [][]float64, assign []int) {
	n := len(pts)
	if cells < 1 {
		cells = 1
	}
	if cells > n {
		cells = n
	}
	centroids = make([][]float64, cells)
	for c := range centroids {
		centroids[c] = append([]float64(nil), pts[c*n/cells]...)
	}
	assign = make([]int, n)
	dim := len(pts[0])
	for it := 0; it < kmeansIterations; it++ {
		changed := it == 0 // the first pass always updates the centroids
		for i, p := range pts {
			best, bd := 0, math.Inf(1)
			for c, ctr := range centroids {
				if d := sqDist(p, ctr); d < bd {
					bd, best = d, c
				}
			}
			if assign[i] != best {
				assign[i], changed = best, true
			}
		}
		if !changed {
			break
		}
		sums := make([][]float64, cells)
		counts := make([]int, cells)
		for c := range sums {
			sums[c] = make([]float64, dim)
		}
		for i, p := range pts {
			c := assign[i]
			counts[c]++
			s := sums[c]
			for t, v := range p {
				s[t] += v
			}
		}
		for c := range centroids {
			if counts[c] == 0 {
				continue
			}
			inv := 1 / float64(counts[c])
			for t := range centroids[c] {
				centroids[c][t] = sums[c][t] * inv
			}
		}
	}
	return centroids, assign
}

func sqDist(a, b []float64) float64 {
	var s float64
	for i := range a {
		d := a[i] - b[i]
		s += d * d
	}
	return s
}

// neighborEdge is one edge of the graph: the neighbour's pool index and the
// exact full-dimension similarity of the pair.
type neighborEdge struct {
	to  int
	sim float64
}

// levelIndex is one level's k-NN structure as a value: everything a repair
// needs to treat a later write as a LOCAL event instead of a global rebuild.
// The vectors themselves are deliberately not part of it — they belong to the
// pool, and every method that needs them takes them alongside, aligned by
// position.
//
// Positions are append-only: an insert appends, a removal tombstones (live
// goes false, edges empty). Consolidation — a fresh buildLevelIndex — is what
// compacts. ids may be nil for a throwaway index built positionally.
type levelIndex struct {
	ids  []string
	pos  map[string]int // id -> position; maintained only when ids are known
	live []bool
	// threshold is PINNED: drawn from the pool's pair distribution when the
	// index was built in full, and deliberately NOT redrawn on repair — a
	// redraw is a global event, and bounded drift is the price of locality.
	// drift() measures how far the pin has strayed.
	threshold float64
	k         int         // neighbours kept per artifact when built
	basis     [][]float64 // projection for cell assignment; nil = none
	centroids [][]float64 // IVF cell centroids, in projected space
	cellOf    []int
	members   [][]int // per cell, positions assigned to it (may hold tombstones; filter by live)
	edges     [][]neighborEdge
}

// buildNeighborGraph builds the symmetrized k-NN graph over the pool.
// Adjacency lists come back sorted by neighbour index, self-free, and
// symmetric: b lists a exactly when a lists b, with the identical similarity.
//
// Symmetrization is by union — an edge survives if either endpoint ranked the
// other in its top k — because a miss by one endpoint's candidate search
// should not need a second miss to be forgiven. The union also means degree k
// is an outbound bound, not a hard cap: a vertex many others point at carries
// their edges too.
func buildNeighborGraph(vecs [][]float64, cfg knnConfig) [][]neighborEdge {
	return buildIndexCore(nil, vecs, cfg).edges
}

// buildIndexCore is the full construction, keeping every intermediate the
// repair path needs: the basis, the cells, the assignments and the edges.
func buildIndexCore(ids []string, vecs [][]float64, cfg knnConfig) *levelIndex {
	n := len(vecs)
	x := &levelIndex{
		ids:   ids,
		live:  make([]bool, n),
		edges: make([][]neighborEdge, n),
	}
	for i := range x.live {
		x.live[i] = true
	}
	if ids != nil {
		x.pos = make(map[string]int, n)
		for i, id := range ids {
			x.pos[id] = i
		}
	}
	out := x.edges
	if n < 2 {
		return x
	}
	k := cfg.k
	if k <= 0 {
		k = defaultNeighborK
	}
	rng := newXorshift(projectionSeed)
	basis := fitProjection(vecs, cfg.pcaDims, rng)
	proj := vecs
	if basis != nil {
		proj = make([][]float64, n)
		for i, v := range vecs {
			proj[i] = project(basis, v)
		}
	}
	cells := cfg.cells
	if cells <= 0 {
		cells = int(math.Sqrt(float64(n)))
	}
	centroids, assign := kmeansCells(proj, cells)
	members := make([][]int, len(centroids))
	for i, c := range assign {
		members[c] = append(members[c], i)
	}
	x.k, x.basis, x.centroids, x.cellOf, x.members = k, basis, centroids, assign, members

	// rerank is the exact-scoring pool per vertex: wide enough that projection
	// error rarely evicts a true neighbour before exact scores can save it,
	// narrow enough that full-dimension work stays a rounding error next to
	// candidate generation.
	rerank := 3 * k
	probe := probeCells
	if probe > len(centroids) {
		probe = len(centroids)
	}

	type cand struct {
		idx   int
		score float64
	}
	// Ties break by index, so the build is a total order, never a coin flip.
	byScore := func(cands []cand) func(a, b int) bool {
		return func(a, b int) bool {
			if cands[a].score != cands[b].score {
				return cands[a].score > cands[b].score
			}
			return cands[a].idx < cands[b].idx
		}
	}

	topk := make([][]cand, n)
	cellDist := make([]float64, len(centroids))
	near := make([]int, probe)
	var cands []cand
	for i := 0; i < n; i++ {
		for c, ctr := range centroids {
			cellDist[c] = sqDist(proj[i], ctr)
		}
		// The nearest probe cells, by repeated selection — probe is tiny, and
		// strict less keeps the lowest index on ties.
		for t := range near {
			best, bd := -1, math.Inf(1)
			for c, dc := range cellDist {
				if dc < bd && !intIn(near[:t], c) {
					bd, best = dc, c
				}
			}
			near[t] = best
		}
		cands = cands[:0]
		for _, c := range near {
			for _, j := range members[c] {
				if j == i {
					continue
				}
				cands = append(cands, cand{idx: j, score: dot(proj[i], proj[j])})
			}
		}
		sort.Slice(cands, byScore(cands))
		if len(cands) > rerank {
			cands = cands[:rerank]
		}
		if basis != nil {
			// The exact rerank: replace projected scores with full-dimension
			// ones. Without a basis the scores above already are exact.
			for t := range cands {
				cands[t].score = dot(vecs[i], vecs[cands[t].idx])
			}
			sort.Slice(cands, byScore(cands))
		}
		if len(cands) > k {
			cands = cands[:k]
		}
		topk[i] = append([]cand(nil), cands...)
	}

	// Symmetrize: collapse both directions onto (low, high) pairs, dedupe, and
	// scatter each surviving edge to both endpoints.
	type undirected struct {
		a, b int
		sim  float64
	}
	all := make([]undirected, 0, n*k)
	for i, es := range topk {
		for _, e := range es {
			a, b := i, e.idx
			if a > b {
				a, b = b, a
			}
			all = append(all, undirected{a: a, b: b, sim: e.score})
		}
	}
	sort.Slice(all, func(u, v int) bool {
		if all[u].a != all[v].a {
			return all[u].a < all[v].a
		}
		return all[u].b < all[v].b
	})
	for t, e := range all {
		if t > 0 && all[t-1].a == e.a && all[t-1].b == e.b {
			continue
		}
		out[e.a] = append(out[e.a], neighborEdge{to: e.b, sim: e.sim})
		out[e.b] = append(out[e.b], neighborEdge{to: e.a, sim: e.sim})
	}
	for i := range out {
		es := out[i]
		sort.Slice(es, func(a, b int) bool { return es[a].to < es[b].to })
	}
	return x
}

// nearestCells returns the indexes of the n centroids nearest to p, by
// repeated selection — n is tiny, and strict less keeps the lowest index on
// ties, so the pick is a total order.
func nearestCells(p []float64, centroids [][]float64, n int) []int {
	if n > len(centroids) {
		n = len(centroids)
	}
	near := make([]int, 0, n)
	for len(near) < n {
		best, bd := -1, math.Inf(1)
		for c, ctr := range centroids {
			if intIn(near, c) {
				continue
			}
			if d := sqDist(p, ctr); d < bd {
				bd, best = d, c
			}
		}
		near = append(near, best)
	}
	return near
}

func intIn(s []int, v int) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

// sampledSims returns an ascending sample of the pool's off-diagonal EXACT
// similarities — the distribution sortedOffDiagonal materializes in full, at a
// bounded cost. A pool with no more pairs than the budget contributes every
// pair, so small pools read the very distribution the exact path uses; above
// it the percentile becomes an estimate, and at this budget's size a tight
// one.
func sampledSims(vecs [][]float64, budget int, rng *xorshift) []float64 {
	n := len(vecs)
	if n < 2 {
		return nil
	}
	if total := n * (n - 1) / 2; total <= budget {
		all := make([]float64, 0, total)
		for i := 0; i < n; i++ {
			for j := i + 1; j < n; j++ {
				all = append(all, dot(vecs[i], vecs[j]))
			}
		}
		sort.Float64s(all)
		return all
	}
	out := make([]float64, budget)
	for t := range out {
		i := rng.intn(n)
		j := rng.intn(n - 1)
		if j >= i {
			j++
		}
		out[t] = dot(vecs[i], vecs[j])
	}
	sort.Float64s(out)
	return out
}

// thresholdNeighbors prunes the graph to the edges clearing the threshold —
// the sparse analogue of thresholdGraph. Symmetric in, symmetric out: both
// directions of an edge carry the identical similarity, so they pass or fail
// together.
func thresholdNeighbors(nbrs [][]neighborEdge, threshold float64) [][]int {
	adj := make([][]int, len(nbrs))
	for i, es := range nbrs {
		for _, e := range es {
			if e.sim >= threshold {
				adj[i] = append(adj[i], e.to)
			}
		}
	}
	return adj
}

// maximalCliquesSparse enumerates every maximal clique of size >= 2 over
// sorted adjacency lists — the same contract and canonical output as
// maximalCliques, without the n×n matrix that function needs handed to it.
//
// The outer loop is Bron–Kerbosch with vertex ordering: each vertex v seeds
// one search over its own neighbourhood, with v's earlier neighbours in the
// exclusion set, so every clique is found exactly once — from its
// lowest-indexed member. Inside a neighbourhood the recursion is the same
// pivoting search the dense version runs, over sorted-slice intersections
// instead of matrix rows. Work is bounded by neighbourhood size rather than
// pool size, which is the point: on a degree-bounded graph the dense outer
// loop would rebuild near-pool-length candidate sets pool-many times.
//
// limit aborts the enumeration exactly as in the dense version: an accepted
// level never reaches it, so aborting can only cut short results that were
// about to be rejected.
func maximalCliquesSparse(adj [][]int, limit int) [][]int {
	var out [][]int
	aborted := false

	contains := func(v, w int) bool {
		s := adj[v]
		t := sort.SearchInts(s, w)
		return t < len(s) && s[t] == w
	}

	var bk func(r, p, x []int)
	bk = func(r, p, x []int) {
		if aborted {
			return
		}
		if limit > 0 && len(out) > limit {
			aborted = true
			return
		}
		if len(p) == 0 && len(x) == 0 {
			if len(r) >= 2 {
				clique := append([]int(nil), r...)
				sort.Ints(clique)
				out = append(out, clique)
			}
			return
		}
		// Pivot: the vertex of p∪x with the most neighbours in p, lowest index
		// winning ties — the dense version's rule.
		pivot, best := -1, -1
		for _, v := range p {
			if c := countIn(p, adj[v]); c > best {
				best, pivot = c, v
			}
		}
		for _, v := range x {
			if c := countIn(p, adj[v]); c > best {
				best, pivot = c, v
			}
		}
		var cand []int
		for _, v := range p {
			if pivot < 0 || !contains(pivot, v) {
				cand = append(cand, v)
			}
		}
		for _, v := range cand {
			bk(append(r, v), intersectSorted(p, adj[v]), intersectSorted(x, adj[v]))
			p = removeSorted(p, v)
			x = insertSorted(x, v)
		}
	}

	for v := 0; v < len(adj) && !aborted; v++ {
		if len(adj[v]) == 0 {
			continue
		}
		var p, x []int
		for _, w := range adj[v] {
			if w > v {
				p = append(p, w)
			} else {
				x = append(x, w)
			}
		}
		bk([]int{v}, p, x)
	}

	sort.Slice(out, func(a, b int) bool { return lessInts(out[a], out[b]) })
	return out
}

// countIn reports how many elements of list appear in the ascending slice
// sortedSet.
func countIn(list, sortedSet []int) int {
	c := 0
	for _, v := range list {
		t := sort.SearchInts(sortedSet, v)
		if t < len(sortedSet) && sortedSet[t] == v {
			c++
		}
	}
	return c
}

// intersectSorted returns the elements common to two ascending slices, as a
// fresh ascending slice.
func intersectSorted(a, b []int) []int {
	var out []int
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] < b[j]:
			i++
		case a[i] > b[j]:
			j++
		default:
			out = append(out, a[i])
			i++
			j++
		}
	}
	return out
}

// removeSorted returns a fresh copy of the ascending slice s without v.
func removeSorted(s []int, v int) []int {
	out := make([]int, 0, len(s))
	for _, x := range s {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}

// insertSorted returns a fresh copy of the ascending slice s with v inserted
// in order.
func insertSorted(s []int, v int) []int {
	at := sort.SearchInts(s, v)
	out := make([]int, 0, len(s)+1)
	out = append(out, s[:at]...)
	out = append(out, v)
	return append(out, s[at:]...)
}

// buildLevelIndex is the full sparse construction as a persistable value: the
// graph, the pinned threshold, and the machinery a later repair reuses (the
// basis and the cells). This is the CONSOLIDATION operation — everything it
// fixes stays fixed until the next one.
func buildLevelIndex(ids []string, vecs [][]float64, cfg clusterConfig) *levelIndex {
	x := buildIndexCore(ids, vecs, cfg.neighbors)
	sorted := sampledSims(vecs, thresholdSampleBudget, newXorshift(thresholdSeed))
	x.threshold = percentileOf(sorted, cfg.percentile, cfg.floor)
	return x
}

// cluster is one clustering pass without the n×n matrix: candidate edges come
// from the index's k-NN graph and cliques are enumerated over adjacency lists,
// at the index's PINNED threshold. vecs is aligned to index POSITIONS;
// tombstoned positions may be nil — they carry no edges, so they are never
// read.
//
// There is deliberately no percentile-raising retry ladder here. The ladder
// exists in buildLevel because the dense path has no other answer to a graph
// whose cliques explode; raising the threshold was the only lever. But in the
// regime that explodes a k-NN graph — a natural cluster LARGER than k, whose
// subgraph is near-complete with holes — the ladder is actively harmful: the
// similarities inside such a cluster are tightly packed, so a raised threshold
// prunes its edges nearly at random, and the accepted result is confetti (tiny
// cliques, mass orphans) that looks identical at the next level and never
// converges. Measured before this design:
// TestOverKClustersReassembleUpTheLattice found best-node F1 of 0.077.
//
// So the sparse path makes one attempt at the pinned threshold — the regime
// where its semantics match the exact path — and when that explodes it
// switches construction instead of threshold: greedy verified neighbourhoods,
// which are built FOR the dense regime.
func (x *levelIndex) cluster(vecs [][]float64) levelResult {
	n := 0
	for _, l := range x.live {
		if l {
			n++
		}
	}
	cliques := maximalCliquesSparse(thresholdNeighbors(x.edges, x.threshold), n)
	if len(cliques) <= n {
		return levelResult{cliques: cliques, threshold: x.threshold}
	}
	return levelResult{cliques: greedyNeighborhoodClusters(vecs, x.edges, x.threshold), threshold: x.threshold}
}

// insert adds one artifact to the index as a LOCAL event: assign it a cell
// through the stored basis and centroids, score it exactly against the live
// members of its nearest cells, keep the top k, and stitch the edges both
// ways. The pinned threshold is not redrawn and nothing outside the probed
// cells is touched.
//
// Candidate scoring here is exact from the start — no projected pre-score, no
// rerank pool. The pre-score exists in the full build to cheapen an
// n×candidates term; one insert's candidates are a couple of million
// multiplies, a rounding error, and skipping the approximation removes a
// whole class of divergence from the fresh-build result.
//
// vecAt returns the pool vector at an index position (nil for tombstones).
func (x *levelIndex) insert(id string, vec []float64, vecAt func(int) []float64) {
	pos := len(x.ids)
	x.ids = append(x.ids, id)
	if x.pos == nil {
		x.pos = map[string]int{}
	}
	x.pos[id] = pos
	x.live = append(x.live, true)
	x.edges = append(x.edges, nil)

	p := vec
	if x.basis != nil {
		p = project(x.basis, vec)
	}
	cell := 0
	if len(x.centroids) > 0 {
		bd := math.Inf(1)
		for c, ctr := range x.centroids {
			if d := sqDist(p, ctr); d < bd {
				bd, cell = d, c
			}
		}
		x.members[cell] = append(x.members[cell], pos)
	}
	x.cellOf = append(x.cellOf, cell)

	near := nearestCells(p, x.centroids, probeCells)

	type cand struct {
		idx   int
		score float64
	}
	var cands []cand
	for _, c := range near {
		for _, j := range x.members[c] {
			if j == pos || !x.live[j] {
				continue
			}
			v := vecAt(j)
			if v == nil {
				continue
			}
			cands = append(cands, cand{idx: j, score: dot(vec, v)})
		}
	}
	sort.Slice(cands, func(a, b int) bool {
		if cands[a].score != cands[b].score {
			return cands[a].score > cands[b].score
		}
		return cands[a].idx < cands[b].idx
	})
	k := x.k
	if k <= 0 {
		k = defaultNeighborK
	}
	if len(cands) > k {
		cands = cands[:k]
	}
	for _, c := range cands {
		x.edges[pos] = insertEdge(x.edges[pos], neighborEdge{to: c.idx, sim: c.score})
		x.edges[c.idx] = insertEdge(x.edges[c.idx], neighborEdge{to: pos, sim: c.score})
	}
}

// remove tombstones one artifact and strips its edges from both directions.
// Neighbours do NOT backfill the lost edge with their next-best candidate —
// bounded degradation, healed by the next consolidation. It reports whether
// the id was a live member at all.
func (x *levelIndex) remove(id string) bool {
	pos, ok := x.pos[id]
	if !ok || !x.live[pos] {
		return false
	}
	x.live[pos] = false
	for _, e := range x.edges[pos] {
		x.edges[e.to] = dropEdge(x.edges[e.to], pos)
	}
	x.edges[pos] = nil
	delete(x.pos, id)
	return true
}

// drift measures how far the pool's CURRENT threshold percentile sits from
// the pinned one — the number that decides when local events stop being
// honest and a consolidation is due. liveVecs are the live pool vectors, any
// order.
func (x *levelIndex) drift(liveVecs [][]float64, cfg clusterConfig) float64 {
	fresh := percentileOf(sampledSims(liveVecs, thresholdSampleBudget, newXorshift(thresholdSeed)), cfg.percentile, cfg.floor)
	return math.Abs(fresh - x.threshold)
}

// insertEdge keeps an adjacency list sorted by neighbour position. An edge to
// an already-listed neighbour just refreshes the similarity.
func insertEdge(es []neighborEdge, e neighborEdge) []neighborEdge {
	at := sort.Search(len(es), func(i int) bool { return es[i].to >= e.to })
	if at < len(es) && es[at].to == e.to {
		es[at].sim = e.sim
		return es
	}
	es = append(es, neighborEdge{})
	copy(es[at+1:], es[at:])
	es[at] = e
	return es
}

// dropEdge removes the edge to a position, if present.
func dropEdge(es []neighborEdge, to int) []neighborEdge {
	at := sort.Search(len(es), func(i int) bool { return es[i].to >= to })
	if at < len(es) && es[at].to == to {
		return append(es[:at], es[at+1:]...)
	}
	return es
}

// greedyNeighborhoodClusters is the fallback for the regime where maximal
// cliques are intractable: a natural cluster LARGER than k, whose k-NN
// subgraph is near-complete with holes — the shape whose maximal-clique count
// grows exponentially in the holes.
//
// The construction takes the user-visible property of a clique and drops the
// part that explodes. For each vertex in ascending order not yet claimed, a
// cluster grows through the vertex's strongest neighbours, admitting a member
// only if it clears the threshold against EVERY member already admitted — so
// an emitted cluster carries the same guarantee a clique does (all pairs
// mutually similar above threshold, verified with exact dots), but it is not
// maximal and clusters do not overlap.
//
// What this costs is deliberate. A cluster of 100 shatters into a handful of
// fragments of ~degree size — and the fragments reunite one level UP, where
// they arrive as near-identical representatives and clique immediately. The
// hierarchy repairs downstairs fragmentation upstairs; the alternative was a
// level that yields nothing at all.
func greedyNeighborhoodClusters(vecs [][]float64, nbrs [][]neighborEdge, threshold float64) [][]int {
	joined := make([]bool, len(nbrs))
	var out [][]int
	for v := 0; v < len(nbrs); v++ {
		if joined[v] {
			continue
		}
		// Strongest-first, ties by index: the closest neighbours anchor the
		// cluster, and the order is total so the build is deterministic.
		cand := append([]neighborEdge(nil), nbrs[v]...)
		sort.Slice(cand, func(a, b int) bool {
			if cand[a].sim != cand[b].sim {
				return cand[a].sim > cand[b].sim
			}
			return cand[a].to < cand[b].to
		})
		members := []int{v}
		for _, e := range cand {
			if joined[e.to] || e.sim < threshold {
				continue
			}
			// e.sim already vouches for the pair with v; verify the rest.
			ok := true
			for _, m := range members[1:] {
				if dot(vecs[e.to], vecs[m]) < threshold {
					ok = false
					break
				}
			}
			if ok {
				members = append(members, e.to)
			}
		}
		if len(members) < 2 {
			continue
		}
		for _, m := range members {
			joined[m] = true
		}
		sort.Ints(members)
		out = append(out, members)
	}
	sort.Slice(out, func(a, b int) bool { return lessInts(out[a], out[b]) })
	return out
}

// cohesionVecs is cohesion computed from the vectors rather than from a
// materialized matrix. Cliques are small — bounded by the graph's degree — so
// re-doing the handful of dot products costs less than the matrix the dense
// form reads them from ever could.
func cohesionVecs(vecs [][]float64, members []int) float64 {
	min := 1.0
	for i := 0; i < len(members); i++ {
		for j := i + 1; j < len(members); j++ {
			if s := dot(vecs[members[i]], vecs[members[j]]); s < min {
				min = s
			}
		}
	}
	return min
}

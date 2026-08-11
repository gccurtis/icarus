package knowledge

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
)

// windowSpan is a chunk of text as a byte range plus its position.
type windowSpan struct {
	ordinal    int
	start, end int
}

// sentenceSpan is one sentence as a byte range plus its rune length.
type sentenceSpan struct {
	start, end int
	runes      int
}

// sentenceSpans splits text into sentences, deterministically: a sentence ends
// after a run of '.', '!' or '?' followed by whitespace (or end of text), or at
// a newline — flatten emits one block per line, so a newline is always a
// component boundary. Every byte belongs to exactly one sentence, so
// concatenating the spans reproduces the text.
func sentenceSpans(text string) []sentenceSpan {
	var out []sentenceSpan
	start, runes := 0, 0
	terminated := false // saw '.', '!' or '?' — the next whitespace ends the sentence
	for i, r := range text {
		runes++
		switch {
		case r == '\n':
			out = append(out, sentenceSpan{start: start, end: i + 1, runes: runes})
			start, runes, terminated = i+1, 0, false
		case r == '.' || r == '!' || r == '?':
			terminated = true
		case terminated && (r == ' ' || r == '\t' || r == '\r'):
			out = append(out, sentenceSpan{start: start, end: i + utf8RuneLen(r), runes: runes})
			start, runes, terminated = i+utf8RuneLen(r), 0, false
		default:
			terminated = false
		}
	}
	if start < len(text) {
		out = append(out, sentenceSpan{start: start, end: len(text), runes: runes})
	}
	return out
}

func utf8RuneLen(r rune) int {
	switch {
	case r < 0x80:
		return 1
	case r < 0x800:
		return 2
	case r < 0x10000:
		return 3
	default:
		return 4
	}
}

// windowSpans splits text into overlapping windows of roughly target runes,
// cutting on sentence boundaries: sentences accumulate until the target is
// reached, and the next window re-opens with the previous window's trailing
// sentences (up to overlap runes) so local context carries across the cut. The
// large target is intentional — references, pronouns and qualifications should
// resolve within the embedded text. A single sentence longer than the target is
// hard-split on rune boundaries as a fallback. Deterministic, and every cut
// lands on a rune boundary, so a range always slices back out of the text.
func windowSpans(text string, target, overlap int) []windowSpan {
	if target <= 0 {
		target = 1
	}
	if overlap < 0 || overlap >= target {
		overlap = target / 10
	}
	sentences := sentenceSpans(text)
	if len(sentences) == 0 {
		return nil
	}
	// An oversized sentence is mechanically split so no single unit exceeds the
	// target.
	sentences = splitOversized(text, sentences, target)

	var spans []windowSpan
	ord := 0
	for i := 0; i < len(sentences); {
		runes := 0
		j := i
		for j < len(sentences) {
			if j > i && runes+sentences[j].runes > target {
				break
			}
			runes += sentences[j].runes
			j++
		}
		spans = append(spans, windowSpan{ordinal: ord, start: sentences[i].start, end: sentences[j-1].end})
		ord++
		if j >= len(sentences) {
			break
		}
		// Re-open with the trailing sentences that fit in the overlap budget —
		// always at least one step forward, so the loop progresses.
		next := j
		tail := 0
		for next > i+1 && tail+sentences[next-1].runes <= overlap {
			tail += sentences[next-1].runes
			next--
		}
		i = next
	}
	// Drop windows that carry no content. A blank window has nothing to embed,
	// and it is not harmlessly ignored downstream: an embeddings provider that
	// rejects an empty string answers the WHOLE batch with an empty result, so a
	// single blank window zeroes the vectors for every window beside it. Cheaper
	// and clearer to never produce one. Ordinals are re-numbered so they stay
	// contiguous.
	kept := spans[:0]
	ord = 0
	for _, s := range spans {
		if strings.TrimSpace(text[s.start:s.end]) == "" {
			continue
		}
		s.ordinal = ord
		ord++
		kept = append(kept, s)
	}
	return kept
}

// splitOversized hard-splits any sentence longer than target runes into
// target-sized chunks on rune boundaries, leaving normal sentences untouched.
func splitOversized(text string, sentences []sentenceSpan, target int) []sentenceSpan {
	var out []sentenceSpan
	for _, s := range sentences {
		if s.runes <= target {
			out = append(out, s)
			continue
		}
		// Rune-start offsets within the oversized sentence.
		offs := make([]int, 0, s.runes+1)
		for i := range text[s.start:s.end] {
			offs = append(offs, s.start+i)
		}
		offs = append(offs, s.end)
		for r := 0; r < s.runes; r += target {
			endR := r + target
			if endR > s.runes {
				endR = s.runes
			}
			out = append(out, sentenceSpan{start: offs[r], end: offs[endR], runes: endR - r})
		}
	}
	return out
}

// --- vectors (embeddings are stored unit-normalized, so cosine == dot) ---

func normalize(v []float64) []float64 {
	var s float64
	for _, x := range v {
		s += x * x
	}
	if s == 0 {
		return append([]float64(nil), v...)
	}
	inv := 1 / math.Sqrt(s)
	out := make([]float64, len(v))
	for i, x := range v {
		out[i] = x * inv
	}
	return out
}

func dot(a, b []float64) float64 {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	var s float64
	for i := 0; i < n; i++ {
		s += a[i] * b[i]
	}
	return s
}

// centroid returns the unit-normalized sum of the given vectors (the KLR
// cluster representative — same direction as the normalized mean).
func centroid(vecs [][]float64) []float64 {
	if len(vecs) == 0 {
		return nil
	}
	d := 0
	for _, v := range vecs {
		if len(v) > d {
			d = len(v)
		}
	}
	sum := make([]float64, d)
	for _, v := range vecs {
		for i, x := range v {
			sum[i] += x
		}
	}
	return normalize(sum)
}

// nodeID derives a node's identity from what it IS: its member set, at a level,
// within a scope. A node is nothing but a clique's representative, so two
// clusterings that find the same clique should produce the same node — and with
// a content address they do, with no lookup and no state to keep in step.
//
// It replaced a minted id, which made every rebuild discard and re-create the
// entire tier even when the frontier had not moved. That is fine when a rebuild
// is the only way to maintain the lattice and ruinous the moment anything wants
// to reason about what changed.
//
// The member ids are sorted for hashing only: MemberIDs keeps its own order,
// which membership edges are stored in, but a set is a set and the same clique
// discovered in a different order is the same node.
//
// Fields are length-prefixed so that no two different field splits can hash
// alike — without it ("ab", "c") and ("a", "bc") would collide.
func nodeID(projectID, localRefID string, level int, memberIDs []string) string {
	sorted := append([]string(nil), memberIDs...)
	sort.Strings(sorted)

	h := sha256.New()
	var n [8]byte
	field := func(s string) {
		binary.LittleEndian.PutUint64(n[:], uint64(len(s)))
		h.Write(n[:])
		h.Write([]byte(s))
	}
	field(projectID)
	field(localRefID)
	binary.LittleEndian.PutUint64(n[:], uint64(level))
	h.Write(n[:])
	for _, m := range sorted {
		field(m)
	}
	// 16 bytes, so an id is the same 32-hex-character shape newID produces and
	// nothing downstream can tell a derived id from a minted one.
	return hex.EncodeToString(h.Sum(nil)[:16])
}

// hashID derives a 16-byte id from length-prefixed fields, hex-encoded.
//
// Length prefixes, for the same reason nodeID uses them: without one, ("ab", "c")
// and ("a", "bc") hash alike, so two different field splits would collide.
//
// 16 bytes because that is the shape a minted id has. encodeEdges decodes a
// stored index's artifact ids as 16 raw bytes and rejects anything else, so a
// derived id has to be indistinguishable from the minted one it replaces.
func hashID(fields ...string) string {
	h := sha256.New()
	var n [8]byte
	for _, f := range fields {
		binary.LittleEndian.PutUint64(n[:], uint64(len(f)))
		h.Write(n[:])
		h.Write([]byte(f))
	}
	return hex.EncodeToString(h.Sum(nil)[:16])
}

// localRefID is a source's internal id, derived from the origin it stands for.
//
// It used to be 16 random bytes. Deriving it costs nothing — the triple is
// already unique, since knowledge_sources carries UNIQUE(project_id,
// source_type, source_id) — and it buys the thing random ids cannot: the same
// origin admitted to the same project resolves to the same id, in any database.
//
// The project is part of it, so identical content in two projects stays two
// sources. A project is an access boundary; sharing ids across one would be a
// scope hole.
func localRefID(projectID string, identity ...string) string {
	fields := []string{"localref", projectID}
	fields = append(fields, identity...)
	return hashID(fields...)
}

// windowID derives a window's id from the source it belongs to, its text, and
// which occurrence of that text it is.
//
// This replaces 16 bytes of crypto/rand, and the reason is that random ids made
// ingest irreproducible in a way nothing reported. Both frontier queries order by
// id, and the sparse path's threshold sample draws pairs by INDEX under a fixed
// seed — so the same seed selected the same positions holding different vectors.
// A fresh ingest of identical content pinned a different threshold, formed
// different cliques, and produced a different lattice: measured on the 596-file
// corpus, 172 nodes at 0.563 on one run and 205 at 0.564 on the next, from
// byte-identical code. Clustering was always a pure function of its inputs; one
// of its inputs arrived shuffled.
//
// # Why text and occurrence, and not the ordinal
//
// Keying on the ordinal would be worse than the random ids it replaces.
// Prepending a paragraph shifts every ordinal, so every id downstream of an edit
// would churn — and a churned id is a re-clustered subtree and a dropped corpus
// reference for content that did not change.
//
// Text plus occurrence-among-identical-texts reproduces exactly what the priorIDs
// queue did by lookup: three identical windows becoming four means the first three
// keep their ids and the fourth is new. That queue is now gone, because
// inheritance is what the hash IS rather than machinery that reconstructs it.
//
// The occurrence index is also what keeps an id a primary key. Two windows with
// identical text in one source are two artifacts and must not collide.
func windowID(localRef string, occurrence int, text string) string {
	return hashID("window", localRef, strconv.Itoa(occurrence), text)
}

// --- KLR clustering ---
//
// A level is built from the full pairwise cosine matrix of the current pool: a
// relative threshold is drawn from that level's similarity distribution, pairs
// clearing it form a graph, and the clusters are the graph's maximal cliques —
// every pair inside a cluster clears the threshold, and cliques may overlap, so
// an artifact can join more than one cluster. Each clique becomes a
// representative node; artifacts that joined no clique are orphans and carry
// upward unchanged. The ascent repeats until no clique forms, so a source ends
// as a forest of roots and orphans (its frontier), never a forced single root.

// clusterConfig are the clustering calibration knobs.
type clusterConfig struct {
	percentile float64 // where in the off-diagonal similarity distribution the threshold sits
	floor      float64 // the threshold never drops below this
	maxLevels  int     // hard backstop on ascent depth
	// maxPool bounds the pool one ascent may cluster. It exists because pairwise
	// materializes the complete n×n similarity matrix — n²·8 bytes, independent of
	// vector dimension — so an unbounded pool is an unbounded allocation: 800MB at
	// n=10,000, 20GB at n=50,000. A project large enough to reach those sizes would
	// not cluster slowly, it would die in make().
	maxPool int
	// neighbors configures the sparse clustering path (neighbors.go). While its
	// enabled flag is false a pool over maxPool is refused, exactly as before.
	neighbors knnConfig
}

// defaultMaxPool is the crossover between the two clustering constructions, and
// it sits where they cost the same. Measured (BenchmarkCrossover, dim=1536, both
// constructions over the same pools):
//
//	n         exact    sparse
//	500       0.12s     0.70s
//	1,000     0.42s     1.20s
//	2,000     1.83s     1.70s   ← they cross here
//	3,000     4.46s     2.60s
//	4,000     8.34s     3.03s
//
// It was 4,000, and that number came from a memory budget — the exact path's
// matrix is n²·8 bytes, ~128MB at 4,000 — rather than from a clock. Timing it
// showed the exact construction is already the slower one well before that.
//
// Two things move together at this boundary, which is why one number governs
// both. Above it the sparse construction is faster AND persists a level index, so
// the next rebuild can repair the level locally instead of reconstructing it
// (measured 15.7× on a 1% delta at 20k, record 0146). Below it the exact
// construction is faster and there is nothing worth persisting: building an index
// for a sub-crossover pool costs more than the ascent it would accelerate, and
// clustering over one would make the construction depend on history — the same
// pool clustering one way before an index existed and another after, churning
// every content-addressed node id at the transition (record 0159).
//
// So at 4,000 the 2,000–4,000 band was wrong three ways at once: the slower
// construction, no persisted index, and therefore no incremental clustering at
// all. Nothing about that needed a second setting; the crossover was simply in
// the wrong place.
const defaultMaxPool = 2000

func defaultClusterConfig() clusterConfig {
	return clusterConfig{percentile: 0.75, floor: 0.30, maxLevels: 32, maxPool: defaultMaxPool, neighbors: defaultKNNConfig()}
}

// pairwise returns the full cosine-similarity matrix for unit vectors.
func pairwise(vecs [][]float64) [][]float64 {
	n := len(vecs)
	sims := make([][]float64, n)
	for i := range sims {
		sims[i] = make([]float64, n)
	}
	for i := 0; i < n; i++ {
		sims[i][i] = 1
		for j := i + 1; j < n; j++ {
			s := dot(vecs[i], vecs[j])
			sims[i][j], sims[j][i] = s, s
		}
	}
	return sims
}

// relativeThreshold picks the clustering threshold for one level: the given
// percentile of the level's off-diagonal similarity distribution, never below
// the floor. Drawing it from the distribution keeps the criterion meaningful at
// every level — within-document similarities run higher than cross-document
// ones, so a flat constant would over-cluster one tier and under-cluster the
// other.
func relativeThreshold(sims [][]float64, percentile, floor float64) float64 {
	return percentileOf(sortedOffDiagonal(sims), percentile, floor)
}

// sortedOffDiagonal returns every off-diagonal similarity, ascending.
//
// It is separate from relativeThreshold so buildLevel can build it ONCE and
// query it repeatedly. buildLevel may raise the percentile up to eight times
// against an unchanged matrix, and each of those attempts previously rebuilt and
// re-sorted this whole slice to read a single value out of it. The slice is
// n(n-1)/2 float64 — at the 4,000-artifact pool bound that is ~64MB, built by
// unpreallocated append (so doubling reallocation, up to 2x overshoot) on top of
// the 128MB matrix it copies from, seven times more than necessary, at exactly
// the point where memory is the binding constraint.
func sortedOffDiagonal(sims [][]float64) []float64 {
	n := len(sims)
	if n < 2 {
		return nil
	}
	all := make([]float64, 0, n*(n-1)/2)
	for i := range sims {
		for j := i + 1; j < n; j++ {
			all = append(all, sims[i][j])
		}
	}
	sort.Float64s(all)
	return all
}

// percentileOf reads one percentile out of an ascending distribution, never
// below the floor. Sorting once and indexing repeatedly beats a quickselect per
// query precisely because buildLevel queries the same distribution up to eight
// times.
func percentileOf(sorted []float64, percentile, floor float64) float64 {
	if len(sorted) == 0 {
		return floor
	}
	t := sorted[int(percentile*float64(len(sorted)-1))]
	if t < floor {
		t = floor
	}
	return t
}

// thresholdGraph returns the adjacency matrix of pairs clearing the threshold.
func thresholdGraph(sims [][]float64, threshold float64) [][]bool {
	n := len(sims)
	adj := make([][]bool, n)
	for i := range adj {
		adj[i] = make([]bool, n)
	}
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			if sims[i][j] >= threshold {
				adj[i][j], adj[j][i] = true, true
			}
		}
	}
	return adj
}

// maximalCliques enumerates every maximal clique of size >= 2 in the graph,
// using Bron–Kerbosch with pivoting. Iteration order is fixed (ascending vertex
// index, pivot = most candidate-neighbors with lowest index winning ties), so
// the result is deterministic; cliques are returned with sorted members, in
// lexicographic order.
//
// limit bounds the enumeration: once more than limit cliques have been found the
// search abandons itself and returns what it has. This exists because
// Bron–Kerbosch is worst-case exponential and the only thing that ever bounded
// it was a check its CALLER made after it had already returned — so a dense
// graph could enumerate for an unbounded time producing cliques that were about
// to be thrown away, and do it up to eight times per level.
//
// Aborting cannot change an accepted result. buildLevel only accepts a level
// whose clique count is <= n, so an accepted enumeration is by definition one
// that never reached the cap; only rejected attempts short-circuit. A
// non-positive limit disables the bound.
func maximalCliques(adj [][]bool, limit int) [][]int {
	n := len(adj)
	var out [][]int
	aborted := false

	var bk func(r, p, x []int)
	bk = func(r, p, x []int) {
		// Checked on entry so the abort unwinds the whole recursion promptly: every
		// frame still on the stack returns on its next call rather than finishing its
		// own candidate loop.
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
		// Pivot: the vertex of p∪x with the most neighbors in p.
		pivot, best := -1, -1
		for _, v := range p {
			c := neighborCount(adj, v, p)
			if c > best {
				best, pivot = c, v
			}
		}
		for _, v := range x {
			c := neighborCount(adj, v, p)
			if c > best {
				best, pivot = c, v
			}
		}
		// Branch on p \ N(pivot), ascending.
		var cand []int
		for _, v := range p {
			if pivot < 0 || !adj[pivot][v] {
				cand = append(cand, v)
			}
		}
		for _, v := range cand {
			var np, nx []int
			for _, w := range p {
				if adj[v][w] {
					np = append(np, w)
				}
			}
			for _, w := range x {
				if adj[v][w] {
					nx = append(nx, w)
				}
			}
			bk(append(r, v), np, nx)
			// Move v from p to x.
			p = remove(p, v)
			x = append(x, v)
		}
	}

	all := make([]int, n)
	for i := range all {
		all[i] = i
	}
	bk(nil, all, nil)

	sort.Slice(out, func(a, b int) bool { return lessInts(out[a], out[b]) })
	return out
}

func neighborCount(adj [][]bool, v int, in []int) int {
	c := 0
	for _, w := range in {
		if adj[v][w] {
			c++
		}
	}
	return c
}

func remove(s []int, v int) []int {
	out := s[:0:0]
	for _, x := range s {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}

func lessInts(a, b []int) bool {
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] != b[i] {
			return a[i] < b[i]
		}
	}
	return len(a) < len(b)
}

// cohesion is the weakest pairwise similarity inside a clique — the strictest
// summary of how tight the cluster is.
func cohesion(sims [][]float64, members []int) float64 {
	min := 1.0
	for i := 0; i < len(members); i++ {
		for j := i + 1; j < len(members); j++ {
			if s := sims[members[i]][members[j]]; s < min {
				min = s
			}
		}
	}
	return min
}

// levelResult is one clustering pass: the cliques found (as pool indices) and
// the threshold that formed them.
type levelResult struct {
	cliques   [][]int
	threshold float64
}

// buildLevel runs one clustering pass over the pool's similarity matrix. The
// level guard bounds clique explosion: overlapping cliques can outnumber the
// pool on dense graphs, and when they do the threshold is raised (percentile
// pushed toward 1) and the level re-run; if the guard never satisfies, the level
// yields no clusters, which terminates the ascent safely.
func buildLevel(sims [][]float64, cfg clusterConfig) levelResult {
	n := len(sims)
	// Built once, queried per attempt. `sims` never changes across attempts and the
	// percentile only rises, so every attempt was reading a different index of an
	// identical distribution — and rebuilding and re-sorting it to do so.
	sorted := sortedOffDiagonal(sims)
	p := cfg.percentile
	for attempt := 0; attempt < 8; attempt++ {
		t := percentileOf(sorted, p, cfg.floor)
		// n is passed as the abort cap: a result with more than n cliques is rejected
		// below anyway, so enumerating past that point is work that can only be
		// thrown away — and on a dense graph it is unboundedly much of it.
		cliques := maximalCliques(thresholdGraph(sims, t), n)
		if len(cliques) <= n {
			return levelResult{cliques: cliques, threshold: t}
		}
		p += (1 - p) / 2
	}
	return levelResult{}
}

// ascentScope is what one ascent is FOR — which tier the nodes it mints belong
// to — together with what that tier persisted the last time it ran.
//
// localRefID empty is the project-wide corpus tier; non-empty scopes the nodes
// to one source's own forest. It is not decoration: it goes into every node id
// (nodeID length-prefixes it), so the same clique found in two scopes is two
// different nodes, and a source's roots can never collide with the corpus
// roots built above them.
//
// stored rides here rather than beside it because a level index is SCOPED
// state — it describes this tier's pool at this level — and repairing against
// another scope's index would diff a pool against one it has nothing to do
// with. Empty means every level builds in full, which is what a first ascent
// and what every source ascent does today (see the note on ascentResult).
type ascentScope struct {
	projectID  string
	localRefID string
	stored     []CorpusLevelIndex
}

// ascentResult is everything one ascent produced: the nodes, the level indexes
// worth persisting, and the per-level narration of repair-versus-consolidate.
//
// Callers take what their scope can keep. The corpus tier keeps all three —
// nodes, indexes and the log lines. A source ascent keeps only the nodes,
// because the index store is keyed on (project, level) with no room for a
// source: an index it produced would have nowhere to go. That asymmetry is
// storage, not mechanics, which is why the ascent computes the same things
// either way rather than asking who is calling.
type ascentResult struct {
	nodes    []Node
	indexes  []CorpusLevelIndex
	outcomes []repairOutcome
}

// ascend builds the lattice above the given pool (ids + unit vectors): it
// clusters level by level, promoting each clique's representative and every
// orphan unchanged, until no clique forms. The members that survive to the
// final pool — roots and never-clustered orphans — are the frontier, which is
// derived, not stored.
//
// This is the ONLY ascent. A source's own forest and the project-wide corpus
// tier were two copies of this loop until Phase 7, differing in one thing that
// was never about scope: only the corpus copy knew how to reuse a persisted
// k-NN index. Collapsing them means a re-synced source repairs its own subtree
// on exactly the same terms the corpus tier repairs itself, the moment it has
// somewhere to keep the index — and it means a change to how the lattice is
// built cannot land in one tier and miss the other.
//
// Two decisions choose the machinery, and NEITHER is a flag (records
// 0148–0149):
//
//   - Construction is chosen by POOL SIZE. maxPool is the crossover between
//     the two constructions, not a ceiling: a level whose pool fits inside it
//     is clustered exactly (the complete n×n matrix is both exact and fast
//     there), and a larger level is clustered over a k-NN graph
//     (neighbors.go). The switch is per LEVEL, not per ascent — a first level
//     too large to be exact usually collapses into a pool that is not. There
//     is no refusal path: no pool is ever too large to cluster, only too large
//     to cluster exactly.
//
//   - Maintenance is chosen by INDEX PRESENCE. A sparse level handed a stored
//     index whose diff is small and whose pin is still honest repairs it;
//     anything else consolidates. levelIndexFor holds that policy, and it
//     already answers "no stored index → build in full", so a scope that has
//     never stored one needs no special case and a tiny pool needs no size
//     threshold.
//
// Note what those two rules do NOT do: an exact level never consults a stored
// index, however small its pool or however recently the index was written.
// Below the crossover the pool is clustered from the complete matrix, full
// stop. Letting an index divert a sub-crossover level onto the k-NN graph
// would make the CONSTRUCTION depend on history rather than on pool size —
// two rebuilds of the identical pool clustering differently depending on
// whether the previous one happened to leave an index behind — and every
// resulting node id would churn. See record 0158.
func ascend(scope ascentScope, poolIDs []string, poolVecs [][]float64, cfg clusterConfig, now time.Time) ascentResult {
	ids := append([]string(nil), poolIDs...)
	vecs := append([][]float64(nil), poolVecs...)
	byLevel := make(map[int]*CorpusLevelIndex, len(scope.stored))
	for i := range scope.stored {
		byLevel[scope.stored[i].Level] = &scope.stored[i]
	}
	var out ascentResult

	for level := 1; level <= cfg.maxLevels && len(ids) > 1; level++ {
		// coh must answer from whatever similarity source the level was built
		// on: the dense path already holds the matrix, the sparse path
		// recomputes the handful of member pairs from the vectors.
		var res levelResult
		var coh func(members []int) float64
		// memberID/memberVec resolve a clique position to the caller's world;
		// the sparse path overrides them because index positions are not pool
		// positions.
		memberID := func(p int) string { return ids[p] }
		memberVec := func(p int) []float64 { return vecs[p] }

		if cfg.maxPool > 0 && len(ids) > cfg.maxPool {
			idx, outcome := levelIndexFor(byLevel[level], ids, vecs, level, cfg)
			out.outcomes = append(out.outcomes, outcome)
			// aligned holds the pool vectors at INDEX positions (tombstones nil).
			aligned := make([][]float64, len(idx.ids))
			byID := make(map[string][]float64, len(ids))
			for i, id := range ids {
				byID[id] = vecs[i]
			}
			for p, id := range idx.ids {
				if idx.live[p] {
					aligned[p] = byID[id]
				}
			}
			res = idx.cluster(aligned)
			coh = func(members []int) float64 { return cohesionVecs(aligned, members) }
			memberID = func(p int) string { return idx.ids[p] }
			memberVec = func(p int) []float64 { return aligned[p] }
			// Flattened whether or not the caller keeps it. Conditioning this on
			// the scope would be the flag records 0148–0149 removed, and it would
			// buy nothing measurable: the flattening walks a graph the level has
			// already paid to build over thousands of vectors.
			out.indexes = append(out.indexes, idx.toStored(level))
		} else {
			sims := pairwise(vecs)
			res = buildLevel(sims, cfg)
			coh = func(members []int) float64 { return cohesion(sims, members) }
		}
		if len(res.cliques) == 0 {
			break
		}

		// Keyed by id rather than by pool position, because a sparse level's
		// cliques name INDEX positions: a repaired index carries tombstones and
		// appends, so position p there is not artifact p here. Ids are unique
		// within a pool, so the two agree wherever the distinction is moot.
		joined := make(map[string]bool)
		var nextIDs []string
		var nextVecs [][]float64
		for _, clique := range res.cliques {
			memberIDs := make([]string, len(clique))
			memberVecs := make([][]float64, len(clique))
			for i, m := range clique {
				memberIDs[i] = memberID(m)
				memberVecs[i] = memberVec(m)
				joined[memberIDs[i]] = true
			}
			rep := centroid(memberVecs)
			n := Node{
				ID:        nodeID(scope.projectID, scope.localRefID, level, memberIDs),
				ProjectID: scope.projectID, LocalRefID: scope.localRefID,
				Level: level, Centroid: rep, Count: len(clique),
				Cohesion: coh(clique), MemberIDs: memberIDs, CreatedAt: now,
			}
			out.nodes = append(out.nodes, n)
			nextIDs = append(nextIDs, n.ID)
			nextVecs = append(nextVecs, rep)
		}
		for i := range ids {
			if !joined[ids[i]] {
				nextIDs = append(nextIDs, ids[i])
				nextVecs = append(nextVecs, vecs[i])
			}
		}

		// Progress guard: heavily overlapping cliques can reproduce a pool of the
		// same size forever (e.g. {A,B},{B,C},{C,A} → three representatives).
		// Without shrinkage the ascent cannot converge, so stop.
		if len(nextIDs) >= len(ids) {
			break
		}
		ids, vecs = nextIDs, nextVecs
	}
	return out
}

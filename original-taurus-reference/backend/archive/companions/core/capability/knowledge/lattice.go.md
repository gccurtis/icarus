# lattice.go

`lattice.go` holds the pure, storage-free machinery the knowledge service
builds on: splitting text into sentences and accumulating them into
overlapping, sentence-aligned windows, the vector arithmetic that treats
embeddings as points on the unit sphere, and the KLR clustering that turns a
flat pool of embedded artifacts into the lattice. None of it touches a store,
an embedder, or a network — it is all deterministic functions over slices,
which is what makes the lattice reproducible and cheap to test.

The clustering rule is the heart of the file. A level is built from the full
pairwise cosine matrix of the current pool: a relative threshold is drawn from
that level's own similarity distribution, pairs clearing it form a graph, and
the clusters are that graph's maximal cliques — every pair inside a cluster is
mutually similar above the threshold. Cliques may overlap, so one artifact can
join several clusters, which is why the structure above the leaves is a DAG
rather than a tree. Artifacts that join no clique are orphans and carry upward
unchanged, and the ascent repeats until no clique forms — so a source ends as a
forest of roots and orphans (its frontier), never a forced single root.

Two design choices run through the file. First, embeddings are always kept
unit-normalized, so cosine similarity collapses to a plain dot product and every
scoring path is a single multiply-accumulate. Second, everything is
deterministic: sentence boundaries follow a fixed terminator-and-whitespace
rule, windows accumulate whole sentences toward a fixed rune target, the
threshold is a percentile of a sorted distribution, and the Bron–Kerbosch
enumeration fixes its iteration and output order, so the same inputs always
yield the same lattice.

## Code breakdown

### Package declaration and imports

```go
package knowledge

import (
	"math"
	"sort"
	"time"
)
```

The file is part of the `knowledge` package and needs only three standard
imports: `math` for the square root in normalization, `sort` for the ordered
similarity distribution and the deterministic clique ordering, and `time`
because a built node stamps its `CreatedAt`.

### The windowSpan type

```go
// windowSpan is a chunk of text as a byte range plus its position.
type windowSpan struct {
	ordinal    int
	start, end int
}
```

`windowSpan` describes one chunk of a source before it is embedded: its ordinal
position in the sequence and the `[start, end)` byte range into the original
text. Keeping it as byte offsets rather than a copied substring means the exact
text can always be sliced back out of the source later, which is what lets
retrieval return cited spans.

### The sentenceSpan type

```go
// sentenceSpan is one sentence as a byte range plus its rune length.
type sentenceSpan struct {
	start, end int
	runes      int
}
```

`sentenceSpan` is the unit the chunker accumulates: one sentence as a
`[start, end)` byte range plus its length in runes. Carrying the rune count on
the span means the windowing pass can budget window sizes without re-decoding
the text — each sentence's cost is computed once, at split time.

### Deterministic sentence splitting

```go
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
```

`sentenceSpans` splits text into sentences under a deliberately mechanical
rule: a run of `.`, `!` or `?` followed by whitespace ends a sentence (the
terminating whitespace is included in the span), and a newline always ends one —
`flatten` emits one block per line, so a newline is a component boundary. The
`terminated` flag implements the "run of terminators" part: a terminator sets
it, further terminators keep it set (so `...` or `?!` count as one ending), and
any other rune clears it, so `3.14` never ends a sentence mid-number. Two
properties matter more than linguistic perfection. Every byte belongs to
exactly one sentence — the trailing flush picks up text with no final
terminator — so concatenating the spans reproduces the text exactly, which
keeps every derived byte range sliceable. And the rule is deterministic, with
no model or locale in the loop, so the same text always splits the same way.

### UTF-8 rune length

```go
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
```

`utf8RuneLen` returns how many bytes a rune occupies in UTF-8, by the standard
encoding boundaries. `sentenceSpans` needs it to end a span *after* a
terminating whitespace rune: the range loop yields the rune's starting byte
offset, so the span's end is that offset plus the rune's encoded width.
Inlining the four-way switch keeps the file free of a `unicode/utf8` import for
a one-line computation.

### Splitting text into sentence-aligned windows

```go
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
	return spans
}
```

`windowSpans` is the chunker, built around sentences rather than fixed rune
steps. It first sanitizes its parameters — a non-positive target becomes 1, and
an overlap that is negative or would swallow the whole target falls back to a
tenth of it — then splits the text into sentences and hard-splits any
pathological one via `splitOversized`, so no single unit exceeds the target.
The main loop greedily accumulates whole sentences until adding the next would
cross the target (the `j > i` guard admits at least one sentence per window, so
a window is never empty), emits the span, and re-opens the next window on the
previous window's trailing sentences: it walks backward from the cut, taking
sentences while they fit in the overlap budget, but never back past `i+1` — the
next window always starts at least one sentence after the last one did, so the
loop provably progresses. The large target is intentional — references,
pronouns and qualifications should resolve within the embedded text — and every
boundary is a sentence boundary from `sentenceSpans`, so every cut lands on a
rune boundary and a span always slices cleanly back out of the text.

### Hard-splitting oversized sentences

```go
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
```

`splitOversized` is the fallback for text with no usable sentence structure —
minified code, base64 blobs, an unpunctuated wall of prose. Any sentence longer
than the target is mechanically cut into target-sized chunks on rune
boundaries: it records the byte offset of each rune start (plus an end
sentinel) and slices the sentence every `target` runes. Normal sentences pass
through untouched, so the mechanical cut appears only where the sentence rule
had nothing to work with, and the windowing loop above can rely on the
invariant that no single unit exceeds the target.

### Normalizing a vector

```go
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
```

The banner comment states the invariant the rest of the file relies on: vectors
are stored unit-normalized, so cosine similarity is just a dot product.
`normalize` scales a vector to unit length by dividing each component by the
magnitude. The zero-vector guard is important — dividing by a zero magnitude
would produce NaNs, so instead it returns a fresh copy of the input untouched.
It always allocates a new slice rather than mutating in place, so callers can
normalize a borrowed vector safely.

### The dot product

```go
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
```

`dot` is the similarity primitive every scoring path uses. Because both operands
are unit vectors, their dot product is their cosine similarity directly. Taking
`n` as the shorter of the two lengths makes it tolerant of a length mismatch —
it multiplies over the common prefix rather than panicking — which keeps a
stray dimension difference from crashing a retrieval.

### Computing a cluster representative

```go
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
```

`centroid` produces the representative vector for a clique: the unit-normalized
sum of its members. Since normalizing a sum and normalizing a mean point in the
same direction, the division by the member count is skipped — the result is the
KLR cluster representative either way, and it obeys the file's invariant so it
can be scored with `dot`. It sizes the accumulator to the widest member so a
ragged set of dimensions still sums without an index overflow. This is what each
lattice node stores as its `Centroid`.

### `nodeID` — a node is its member set

A node's id is derived from what it *is* — its member set, at a level, within a
scope — rather than minted:

```go
nodeID(projectID, localRefID, level, memberIDs) = sha256(...)[:16]
```

A node is nothing but a clique's representative, so two clusterings that find the
same clique should produce the same node. With a content address they do, with no
lookup and no state to keep in step.

It replaced `newID()`, which meant every rebuild discarded and re-created the
entire tier even when the frontier had not moved. That is tolerable when a full
rebuild is the only way to maintain the lattice, and ruinous the moment anything
wants to reason about what actually changed — which is the precondition for
incremental clustering.

Two details carry weight:

- **Members are sorted for hashing only.** `MemberIDs` keeps its own order, which
  is the order membership edges are stored in, but a set is a set: the same
  clique discovered in a different order is the same node.
- **Fields are length-prefixed.** Without it `("ab", "c")` and `("a", "bc")` hash
  alike, so a project id ending in the same bytes a local ref begins with could
  collide. `TestNodeIDFieldsCannotRunTogether` pins that.

The digest is truncated to 16 bytes so an id is the same 32-hex-character shape
`newID` produces — nothing downstream can tell a derived id from a minted one.

### The KLR clustering contract

```go
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
```

This banner is the contract everything below implements. Three properties
distinguish KLR from a partitioning scheme like k-means: membership is mutual
(every pair inside a cluster clears the threshold, not just member-to-center),
clusters may overlap (so the lattice is a DAG, not a tree), and nothing is
forced to cluster (orphans pass upward unchanged and the ascent simply stops
when no clique forms, leaving a forest rather than a mandatory single root).

### The clustering calibration knobs

`clusterConfig` gathers four calibration knobs: `percentile` (where in the
off-diagonal similarity distribution the threshold sits), `floor` (the level it
never drops below), `maxLevels` (a hard backstop on ascent depth), and `maxPool`
(the largest pool an ascent will cluster at all). The defaults — the 75th
percentile, a 0.30 floor, and 32 levels — make the criterion selective (only the
top quartile of pairs can connect), keep it meaningful when a level's
similarities are uniformly low, and bound the ascent even if the progress guards
were somehow defeated.

A fifth field, `neighbors`, configures the sparse clustering path (see
[`neighbors.go`](neighbors.go.md)) — a k-NN graph in place of the complete
matrix, which runs for any pool over the `maxPool` crossover. It carries no
on/off switch: mechanics do not have flags here — the system runs whichever
construction is most efficient at the pool's scale, and comparisons between
constructions live in tests or across git history, not in configuration.

`maxPool` is different in kind from the other three. They calibrate *quality*;
this one bounds an **allocation**. `pairwise` materializes the complete n×n
similarity matrix, which is n²·8 bytes *regardless of vector dimension* — 128 MB
at 4,000, 800 MB at 10,000, 20 GB at 50,000. So an unbounded pool is not a slow
clustering, it is a failed `make`. `defaultMaxPool` is 4,000, putting the matrix
around 128 MB (~192 MB peak once `buildLevel` takes its sorted copy): a real but
survivable allocation for one rebuild.

Note the consequence, because it is easy to misread: this is a *ceiling on the
lattice*, not a tuning parameter. A project whose frontier grows past it simply
stops getting a corpus tier. Raising it trades memory for reach; nothing in
*this* file makes the clustering scale — that is what the sparse path in
[`neighbors.go`](neighbors.go.md) exists for.

Measured (`BenchmarkAscend`, 1536 dimensions):

| pool | time | allocated |
|---|---|---|
| 500 | 96 ms | 7 MB |
| 2,000 | 1.73 s | 110 MB |
| 4,000 | 7.80 s | 458 MB |

Both halves are worth knowing. The memory is what the bound exists for; the time
is what a deferred corpus rebuild spends before its result lands (it left the
write path in record 0138, so nothing waits on it — but a slow rebuild is still
a stale corpus tier for its duration). The cost is quadratic, so halving the
bound is roughly a quarter of the bill.

### The pairwise cosine matrix

```go
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
```

`pairwise` computes the full symmetric cosine-similarity matrix for the current
pool. Because the vectors are unit-normalized, each entry is a single `dot`
call; the upper triangle is computed once and mirrored, and the diagonal is
fixed at 1. Every later stage of a level — the threshold, the graph, cohesion —
reads from this one matrix, so similarities are computed exactly once per pair
per level.

### The level-relative threshold

```go
// relativeThreshold picks the clustering threshold for one level: the given
// percentile of the level's off-diagonal similarity distribution, never below
// the floor. Drawing it from the distribution keeps the criterion meaningful at
// every level — within-document similarities run higher than cross-document
// ones, so a flat constant would over-cluster one tier and under-cluster the
// other.
func relativeThreshold(sims [][]float64, percentile, floor float64) float64 {
	return percentileOf(sortedOffDiagonal(sims), percentile, floor)
}
```

It is now a thin composition of two halves, split so `buildLevel` can build the
distribution **once** and query it repeatedly. `sortedOffDiagonal` collects and
sorts every off-diagonal similarity (preallocated to `n(n-1)/2`);
`percentileOf` reads one percentile out of it, clamped up to the floor.

The split matters because `buildLevel` may raise the percentile up to eight
times against an unchanged matrix, and each attempt previously rebuilt and
re-sorted the whole slice to read a single value. That slice is `n(n-1)/2`
float64 — ~64MB at the 4,000 pool bound — built by unpreallocated `append` (so
doubling reallocation, up to 2× overshoot) on top of the 128MB matrix it copies
from, seven times more often than necessary, at exactly the point where memory
is the binding constraint.

Sorting once and indexing repeatedly also beats a quickselect per query, which
would be the better choice only if the distribution were consulted once.

`relativeThreshold` makes the clustering criterion relative rather than
absolute: it collects the off-diagonal similarities, sorts them, and reads the
configured percentile out of the distribution, clamped up to the floor. The
rationale is in the comment — within-document similarities run systematically
higher than cross-document ones, so a flat constant would over-cluster one tier
and under-cluster the other, while a percentile adapts to whatever pool the
level is looking at. The empty-distribution guard (a one-element pool) falls
back to the floor.

### The threshold graph

```go
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
```

`thresholdGraph` converts the similarity matrix into a boolean adjacency
matrix: an edge connects each pair whose similarity clears the threshold. This
is the graph whose maximal cliques become the level's clusters — from here on
the problem is purely graph-theoretic, with the numeric similarities consulted
again only to compute cohesion.

### Enumerating maximal cliques

```go
// maximalCliques enumerates every maximal clique of size >= 2 in the graph,
// using Bron–Kerbosch with pivoting. Iteration order is fixed (ascending vertex
// index, pivot = most candidate-neighbors with lowest index winning ties), so
// the result is deterministic; cliques are returned with sorted members, in
// lexicographic order.
//
// limit bounds the enumeration: once more than limit cliques have been found the
// search abandons itself and returns what it has.
func maximalCliques(adj [][]bool, limit int) [][]int {
	n := len(adj)
	var out [][]int
	aborted := false

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
```

`maximalCliques` is the classic Bron–Kerbosch recursion with pivoting: `r` is
the clique under construction, `p` the vertices that could still extend it, and
`x` the vertices already tried (which is what makes emitted cliques maximal — a
clique is only recorded when both `p` and `x` are empty, so no vertex outside it
could join). The pivot optimization branches only on `p \ N(pivot)`, choosing
the pivot with the most candidate neighbors, which prunes the branches that
would rediscover the same cliques through the pivot's neighbors. Single
vertices are not cliques here — only size two and up is recorded, since a
"cluster of one" is just an orphan. Everything about the order is pinned down:
candidates iterate ascending, ties on the pivot go to the lowest index, each
clique is sorted, and the final list is sorted lexicographically, so the caller
sees one canonical answer for a given graph.

### Clique helpers

```go
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
```

Three small helpers serve the enumeration. `neighborCount` counts a vertex's
neighbors within a candidate set, which is how the pivot is chosen. `remove`
filters one value out of a slice — the `s[:0:0]` expression starts a fresh
zero-capacity slice sharing no backing array with the input, so removing `v`
never corrupts a slice another recursion frame still holds. `lessInts` is the
lexicographic comparison that gives the clique list its canonical order.

### Measuring clique cohesion

```go
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
```

`cohesion` summarizes how tight a clique is by its weakest link — the minimum
pairwise similarity among its members. The minimum is the strictest possible
summary: by the clique property it is guaranteed to clear the level's
threshold, and a high value means every pair in the cluster is strongly
related, not just most of them. Each node records this as its `Cohesion`.

### The levelResult type

```go
// levelResult is one clustering pass: the cliques found (as pool indices) and
// the threshold that formed them.
type levelResult struct {
	cliques   [][]int
	threshold float64
}
```

`levelResult` packages one clustering pass: the cliques found, expressed as
indices into the current pool, and the threshold that formed them. Carrying the
threshold alongside the cliques keeps the pass self-describing — the caller can
see not just what clustered but under what criterion.

### Building one level

```go
// buildLevel runs one clustering pass over the pool's similarity matrix. The
// level guard bounds clique explosion: overlapping cliques can outnumber the
// pool on dense graphs, and when they do the threshold is raised (percentile
// pushed toward 1) and the level re-run; if the guard never satisfies, the level
// yields no clusters, which terminates the ascent safely.
func buildLevel(sims [][]float64, cfg clusterConfig) levelResult {
	n := len(sims)
	sorted := sortedOffDiagonal(sims)   // built once, queried per attempt
	p := cfg.percentile
	for attempt := 0; attempt < 8; attempt++ {
		t := percentileOf(sorted, p, cfg.floor)
		cliques := maximalCliques(thresholdGraph(sims, t), n)   // n = abort cap
		if len(cliques) <= n {
			return levelResult{cliques: cliques, threshold: t}
		}
		p += (1 - p) / 2
	}
	return levelResult{}
}
```

`buildLevel` runs one pass — threshold, graph, cliques — under a guard against
clique explosion. Because cliques overlap, a dense graph can yield more maximal
cliques than the pool has members, which would make a "level up" larger than the
level below it. When that happens the percentile is pushed halfway toward 1 and
the pass re-run with a stricter threshold, up to eight times; if the guard never
satisfies, the level reports no clusters at all, which the ascent treats as its
natural stopping condition. The guard therefore bounds the work without ever
forcing a bad clustering.

Two details make that guard actually bounded rather than nominally so.

**The distribution is built once.** `sims` never changes across attempts and `p`
only rises, so all eight attempts were reading different indices of an identical
sorted slice — and rebuilding and re-sorting it each time to do so.

**`n` is passed to `maximalCliques` as an abort cap.** The explosion check
happens *after* enumeration returns, so before this the guard could only reject a
result Bron–Kerbosch had already spent unbounded time producing — up to eight
times per level. Since any result over `n` is rejected anyway, enumerating past
`n` is work that can only be discarded.

This cannot change an accepted answer: `buildLevel` accepts only a count `<= n`,
so an accepted enumeration is by definition one that never reached the cap. Only
rejected attempts short-circuit. `TestCappedEnumerationMatchesUncappedWhenAccepted`
pins that, and `TestAscendDeterministic` — unchanged — is the proof the whole
refactor preserved behaviour.

### The ascent

```go
// ascend builds the lattice above the given leaves (ids + unit vectors): it
// clusters the pool level by level, promoting each clique's representative and
// every orphan unchanged, until no clique forms. It returns every created node;
// the members that survive to the final pool — roots and never-clustered
// orphans — are the frontier, which is derived, not stored. localRefID scopes
// the nodes to one source; empty means the corpus tier.
//
// maxPool is the CROSSOVER between the two constructions, not a ceiling.
func ascend(projectID, localRefID string, leafIDs []string, leafVecs [][]float64, cfg clusterConfig, now time.Time) []Node {
	ids := append([]string(nil), leafIDs...)
	vecs := append([][]float64(nil), leafVecs...)
	var nodes []Node

	for level := 1; level <= cfg.maxLevels && len(ids) > 1; level++ {
		var res levelResult
		var coh func(members []int) float64
		if cfg.maxPool > 0 && len(ids) > cfg.maxPool {
			levelVecs := vecs
			res = buildLevelSparse(levelVecs, cfg)
			coh = func(members []int) float64 { return cohesionVecs(levelVecs, members) }
		} else {
			sims := pairwise(vecs)
			res = buildLevel(sims, cfg)
			coh = func(members []int) float64 { return cohesion(sims, members) }
		}
		if len(res.cliques) == 0 {
			break
		}

		joined := make(map[int]bool)
		var nextIDs []string
		var nextVecs [][]float64
		for _, clique := range res.cliques {
			memberIDs := make([]string, len(clique))
			memberVecs := make([][]float64, len(clique))
			for i, m := range clique {
				memberIDs[i] = ids[m]
				memberVecs[i] = vecs[m]
				joined[m] = true
			}
			rep := centroid(memberVecs)
			n := Node{
				ID:        nodeID(projectID, localRefID, level, memberIDs),
				ProjectID: projectID, LocalRefID: localRefID,
				Level: level, Centroid: rep, Count: len(clique),
				Cohesion: coh(clique), MemberIDs: memberIDs, CreatedAt: now,
			}
			nodes = append(nodes, n)
			nextIDs = append(nextIDs, n.ID)
			nextVecs = append(nextVecs, rep)
		}
		for i := range ids {
			if !joined[i] {
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
	return nodes
}
```

`maxPool` is the **crossover**, not a ceiling: a level whose pool fits inside
it clusters over the complete matrix (exact, and fast at that size), a larger
level clusters over the k-NN graph ([`neighbors.go`](neighbors.go.md)). There
is no refusal path and no flag — the earlier design refused over-bound pools
(a refusal is honest where the only alternative is a sample that silently
answers a different question), but the k-NN construction is not that kind of
approximation: every similarity it keeps is exact, the whole pool
participates, and only candidate *discovery* is approximate, so recall can
fray at the margin but no member is excluded from the question. With no pool
ever refused, the whole refusal apparatus (`skipped`, `SourceClusterSkipped`,
the warnings) is gone rather than dormant.

The switch is per **level**, not per ascent: a first level too large to be
exact usually collapses into a pool that is not, and every level small enough
to afford exactness gets it. `coh` exists because the two paths answer
cohesion from different sources — the dense path already holds the matrix, the
sparse path recomputes the handful of member pairs from the vectors.

`ascend` is the lattice builder. Starting from the leaves — windows for a
source, or frontier entries for the corpus tier — it repeats the level cycle:
compute the pairwise matrix, run `buildLevel`, and stop as soon as no clique
forms. Each clique becomes a `Node` carrying its member ids, member count,
cohesion, and representative vector from `centroid`; the representatives join
the next pool, and every artifact that joined no clique is promoted as an
orphan, unchanged — nothing is ever forced into a cluster. The trailing
progress guard closes the last termination hole: heavily overlapping cliques
(the `{A,B},{B,C},{C,A}` case in the comment) can produce as many
representatives as there were members, so a level that fails to shrink the pool
ends the ascent. Note what is not returned: the frontier. The members that
survive to the final pool — roots and never-clustered orphans — are derived
later from the stored nodes' membership, not recorded here. `localRefID` scopes
every created node to one source, or to the corpus tier when empty.

### Windows always carry content

`windowSpans` drops any window whose slice is empty or whitespace-only, and
re-numbers ordinals so they stay contiguous. A blank window has nothing to
embed, and it is not harmlessly ignored: an embeddings provider that rejects an
empty string answers the WHOLE batch with an empty result, so one blank window
zeroes the vectors for every window beside it. That is exactly how it surfaced —
a live run against the shipped embedding model returned
`0 vector(s) for 4 input(s)` across every retrieval-backed suite. A more
permissive model had been masking the blank window for as long as it existed.

package knowledge

import (
	"fmt"
	"math"
	"testing"
	"time"
)

// clusteredVectors builds n unit vectors in `dim` dimensions arranged into
// `groups` tight clusters.
//
// The arrangement matters more than it looks. Uniform random vectors in high
// dimensions are very nearly orthogonal to each other, so almost nothing clears
// the similarity threshold, the graph comes out sparse, clique enumeration stays
// trivial, and a benchmark built on them reports a number that has nothing to do
// with real embeddings. Real embeddings of real text cluster, and clustering is
// exactly what makes this expensive — so the fixture has to cluster too.
//
// Deterministic: a fixed LCG, no time or global rand, so a run is comparable to
// the run before it.
func clusteredVectors(n, dim, groups int) [][]float64 {
	seed := uint64(0x2545F4914F6CDD1D)
	next := func() float64 {
		seed ^= seed << 13
		seed ^= seed >> 7
		seed ^= seed << 17
		return float64(seed%2000)/1000 - 1 // [-1, 1)
	}
	// One centre per group.
	centres := make([][]float64, groups)
	for g := range centres {
		v := make([]float64, dim)
		for i := range v {
			v[i] = next()
		}
		centres[g] = normalize(v)
	}
	// Each vector is its centre plus a small perturbation, so within-group
	// similarity is high and between-group similarity is not.
	//
	// The perturbation scales as 1/sqrt(dim) because that is the size of a unit
	// vector's individual components. A fixed absolute perturbation is larger than
	// the components themselves at any realistic dimension, which drowns the centre
	// and produces a fixture that does not cluster at all — the exact failure this
	// whole file exists to avoid. At 0.5/sqrt(dim) the noise has norm ~0.29, giving
	// within-group cosine ~0.96.
	perturb := 0.5 / math.Sqrt(float64(dim))
	out := make([][]float64, n)
	for i := range out {
		c := centres[i%groups]
		v := make([]float64, dim)
		for j := range v {
			v[j] = c[j] + perturb*next()
		}
		out[i] = normalize(v)
	}
	return out
}

func ids(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("id-%d", i)
	}
	return out
}

// BenchmarkAscend measures the clustering ascent at rising pool sizes. It is the
// baseline the corpus tier's cost is judged against, and the number that decides
// whether max_pool is set sensibly.
//
// Watch B/op as much as ns/op: the binding constraint here is the n×n similarity
// matrix (n²·8 bytes, independent of vector dimension), which is why the pool is
// bounded at all.
func BenchmarkAscend(b *testing.B) {
	const dim = 1536 // text-embedding-3-small
	for _, n := range []int{100, 500, 2000, 4000} {
		vecs := clusteredVectors(n, dim, n/50+2)
		leafIDs := ids(n)
		cfg := defaultClusterConfig()
		now := time.Now()
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			// The expected floor for the similarity matrix alone, so a regression in
			// anything else is visible against it.
			b.ReportMetric(float64(n)*float64(n)*8/(1<<20), "sims-MiB")
			b.ResetTimer()
			for b.Loop() {
				_ = ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, cfg, now)
			}
		})
	}
}

// BenchmarkAscendSparse measures the k-NN clustering path at pool sizes the
// exact path cannot afford — run beside BenchmarkAscend to see the trade. The
// n=4000 size overlaps the exact benchmark deliberately; the larger sizes are
// ones the exact path would need gigabytes of matrix for.
//
// Groups are sized BELOW k (n/20 → 20 per group). A natural cluster larger
// than k turns its neighbourhood into a near-complete graph with holes — the
// worst case for maximal-clique enumeration — so over-k pools take the
// verified-neighbourhood construction and fragment by design (k caps cluster
// size), reuniting a level up; benchmarking that regime would measure the
// fallback, not the main path.
func BenchmarkAscendSparse(b *testing.B) {
	const dim = 1536
	for _, n := range []int{4000, 20000} {
		vecs := clusteredVectors(n, dim, n/20)
		leafIDs := ids(n)
		cfg := defaultClusterConfig()
		cfg.maxPool = 2000 // the crossover: pools above it run sparse
		now := time.Now()
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			for b.Loop() {
				_ = ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, cfg, now)
			}
		})
	}
}

// BenchmarkCrossover is the measurement Phase 7 owed: what maxPool actually
// costs on either side of itself, over the SAME pools, at production
// dimension. It answers two questions the open decision rested on — where the
// time crossover really is (the 4,000 default was chosen from a memory budget,
// never a clock), and what a sub-crossover level would give up if a persisted
// index diverted it onto the k-NN graph.
//
//	go test ./core/capability/knowledge/ -run XXX -bench Crossover -benchtime=1x
//
// The `agree` metric is the fraction of the exact construction's level-1
// clusters the sparse one reproduces, compared by content-addressed node id —
// so it is literally "would the ids churn?", not a similarity score. Anything
// under 1.00 is a cluster whose identity would change the first time an index
// appeared for that level, and change back the first time one did not.
//
// Groups are sized under k, the regime the sparse path claims to reproduce.
// Below k the fallback fragments by design and `agree` measures the wrong
// thing (record 0150).
func BenchmarkCrossover(b *testing.B) {
	const dim = 1536
	for _, n := range []int{500, 1000, 2000, 3000, 4000} {
		vecs := clusteredVectors(n, dim, n/20)
		leafIDs := ids(n)
		now := time.Now()
		scope := ascentScope{projectID: "p", localRefID: "ref"}

		exactCfg := defaultClusterConfig()
		exactCfg.maxPool = n // n > n is false, so every level is exact
		exactL1 := map[string]bool{}
		for _, nd := range ascend(scope, leafIDs, vecs, exactCfg, now).nodes {
			if nd.Level == 1 {
				exactL1[nd.ID] = true
			}
		}
		if len(exactL1) == 0 {
			b.Fatalf("n=%d: the exact construction formed no level-1 clusters", n)
		}

		sparseCfg := defaultClusterConfig()
		sparseCfg.maxPool = 1 // every level sparse, whatever its size

		b.Run(fmt.Sprintf("n=%d/exact", n), func(b *testing.B) {
			for b.Loop() {
				_ = ascend(scope, leafIDs, vecs, exactCfg, now)
			}
			b.ReportMetric(float64(len(exactL1)), "l1-nodes")
		})
		b.Run(fmt.Sprintf("n=%d/sparse", n), func(b *testing.B) {
			var nodes []Node
			for b.Loop() {
				nodes = ascend(scope, leafIDs, vecs, sparseCfg, now).nodes
			}
			shared, level1 := 0, 0
			for _, nd := range nodes {
				if nd.Level == 1 {
					level1++
					if exactL1[nd.ID] {
						shared++
					}
				}
			}
			b.ReportMetric(float64(shared)/float64(len(exactL1)), "agree")
			b.ReportMetric(float64(level1), "l1-nodes")
		})
	}
}

// BenchmarkLevelRepair is the number the local-events design exists to
// produce: a 1% delta absorbed by a stored 20,000-artifact level index,
// against building that index from scratch. The repair's cost is dominated by
// the drift measurement (a fixed 200k-pair sample), so it is effectively flat
// in the delta.
func BenchmarkLevelRepair(b *testing.B) {
	const n, dim, delta = 20000, 1536, 200
	vecs := clusteredVectors(n+delta, dim, (n+delta)/20)
	leafIDs := ids(n + delta)
	cfg := defaultClusterConfig()
	stored := buildLevelIndex(leafIDs[:n], vecs[:n], cfg).toStored(1)

	b.Run("repair-1pct", func(b *testing.B) {
		for b.Loop() {
			_, out := levelIndexFor(&stored, leafIDs, vecs, 1, cfg)
			if !out.repaired {
				b.Fatalf("the delta did not repair: %s", out.whyNot)
			}
		}
	})
	b.Run("rebuild", func(b *testing.B) {
		for b.Loop() {
			_ = buildLevelIndex(leafIDs, vecs, cfg)
		}
	})
}

// BenchmarkBuildLevel isolates one level: the pairwise matrix, the threshold
// distribution, and clique enumeration. This is where the sort-once hoist and the
// clique abort cap show up.
func BenchmarkBuildLevel(b *testing.B) {
	const dim = 1536
	for _, n := range []int{100, 500, 2000} {
		vecs := clusteredVectors(n, dim, n/50+2)
		sims := pairwise(vecs)
		cfg := defaultClusterConfig()
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			for b.Loop() {
				_ = buildLevel(sims, cfg)
			}
		})
	}
}

// BenchmarkPairwise is the irreducible floor: F²/2 dot products of `dim` floats,
// plus the n×n matrix itself. Nothing above can be faster than this, which is why
// the scaling fix has to be a graph that is not complete rather than a faster
// pairwise.
func BenchmarkPairwise(b *testing.B) {
	const dim = 1536
	for _, n := range []int{100, 500, 2000} {
		vecs := clusteredVectors(n, dim, n/50+2)
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			for b.Loop() {
				_ = pairwise(vecs)
			}
		})
	}
}

// The fixture has to actually cluster, or every benchmark above measures the
// wrong thing. This guards the guard.
func TestClusteredVectorsActuallyCluster(t *testing.T) {
	vecs := clusteredVectors(60, 256, 6)
	sims := pairwise(vecs)
	var within, between float64
	var nw, nb int
	for i := range vecs {
		for j := i + 1; j < len(vecs); j++ {
			if i%6 == j%6 {
				within += sims[i][j]
				nw++
			} else {
				between += sims[i][j]
				nb++
			}
		}
	}
	w, bt := within/float64(nw), between/float64(nb)
	if w < 0.9 {
		t.Errorf("mean within-group similarity = %.3f, want > 0.9 (groups are not tight)", w)
	}
	if math.Abs(bt) > 0.5 {
		t.Errorf("mean between-group similarity = %.3f, want well below within (groups are not distinct)", bt)
	}
	if w-bt < 0.4 {
		t.Errorf("within (%.3f) and between (%.3f) are too close to produce real clustering", w, bt)
	}
}

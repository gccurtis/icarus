package knowledge

import (
	"fmt"
	"testing"
	"time"
)

// BenchmarkTuningSweep sweeps the sparse construction's tuning surface — k and
// pca_dims, the two knobs that trade quality against cost — and reports, per
// combination, the level-1 cluster recall against the exact construction
// (content-addressed ids make that an exact comparison) alongside the wall
// time the benchmark itself measures. Run it on demand:
//
//	go test ./core/capability/knowledge/ -run XXX -bench TuningSweep -benchtime=1x
//
// Reading the numbers: recall is meaningful where k exceeds the natural
// cluster size (here, groups of 20). Rows with k at or below it measure the
// verified-neighbourhood fallback instead — clusters fragment at level 1 by
// design and reunite a level up, so LOW RECALL THERE IS NOT FAILURE; the
// reassembly test (F1) is that regime's quality gate. This is a measurement
// harness, not an assertion: mechanics are fixed, numbers are tuned, and the
// tuning evidence lives here in the tests.
func BenchmarkTuningSweep(b *testing.B) {
	const n, dim, groups = 1200, 256, 60 // groups of 20
	vecs := clusteredVectors(n, dim, groups)
	leafIDs := ids(n)
	now := time.Now()

	exactCfg := defaultClusterConfig()
	exactCfg.maxPool = n // the whole pool fits: every level exact
	exactL1 := map[string]bool{}
	for _, nd := range ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, exactCfg, now).nodes {
		if nd.Level == 1 {
			exactL1[nd.ID] = true
		}
	}
	if len(exactL1) == 0 {
		b.Fatal("the exact construction formed no level-1 clusters; the sweep would measure nothing")
	}

	for _, k := range []int{8, 16, 32, 64} {
		for _, d := range []int{32, 64, 128, -1} {
			cfg := defaultClusterConfig()
			cfg.maxPool = 100 // far under the pool: level 1 always sparse
			cfg.neighbors = defaultKNNConfig()
			cfg.neighbors.k = k
			cfg.neighbors.pcaDims = d
			b.Run(fmt.Sprintf("k=%d/pca=%d", k, d), func(b *testing.B) {
				var nodes []Node
				for b.Loop() {
					nodes = ascend(ascentScope{projectID: "p", localRefID: "ref"}, leafIDs, vecs, cfg, now).nodes
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
				b.ReportMetric(float64(shared)/float64(len(exactL1)), "recall")
				b.ReportMetric(float64(level1), "l1-nodes")
			})
		}
	}
}

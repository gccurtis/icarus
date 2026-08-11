package knowledge

import (
	"strings"
	"testing"
)

// The repair-versus-consolidate policy, held apart from the machinery: every
// reason a level must NOT repair has to fire, and a clean small diff has to
// count what actually changed.
func TestRepairDecision(t *testing.T) {
	cfg := defaultClusterConfig()
	cfg.neighbors = knnConfig{
		k: 8, pcaDims: 0,
		repairMaxFraction: 0.2, repairMaxDrift: 0.02,
	}
	pool := []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j"}
	arts := func(ids ...string) []CorpusIndexArtifact {
		out := make([]CorpusIndexArtifact, len(ids))
		for i, id := range ids {
			out[i] = CorpusIndexArtifact{ID: id}
		}
		return out
	}

	if _, _, why := repairDecision(nil, pool, cfg); !strings.Contains(why, "no stored index") {
		t.Errorf("nil index: %q", why)
	}
	if _, _, why := repairDecision(&CorpusLevelIndex{K: 4, Artifacts: arts(pool...)}, pool, cfg); !strings.Contains(why, "k changed") {
		t.Errorf("k mismatch: %q", why)
	}
	if _, _, why := repairDecision(&CorpusLevelIndex{K: 8, Basis: [][]float64{{1}}, Artifacts: arts(pool...)}, pool, cfg); !strings.Contains(why, "projection") {
		t.Errorf("projection mismatch: %q", why)
	}
	off := cfg
	off.neighbors.repairMaxFraction = -1
	if _, _, why := repairDecision(&CorpusLevelIndex{K: 8, Artifacts: arts(pool...)}, pool, off); !strings.Contains(why, "repair disabled") {
		t.Errorf("disabled: %q", why)
	}

	// One insert (j missing from the stored set) and one remove (z departed):
	// 2 of 10 = 0.2, exactly at the bound, allowed.
	stored := &CorpusLevelIndex{K: 8, Artifacts: arts("a", "b", "c", "d", "e", "f", "g", "h", "i", "z")}
	ins, rem, why := repairDecision(stored, pool, cfg)
	if why != "" || ins != 1 || rem != 1 {
		t.Errorf("small diff: +%d -%d %q, want +1 -1 allowed", ins, rem, why)
	}

	// Three of ten changed: over the bound, consolidate.
	stored = &CorpusLevelIndex{K: 8, Artifacts: arts("a", "b", "c", "d", "e", "f", "g", "x", "y", "z")}
	if _, _, why := repairDecision(stored, pool, cfg); !strings.Contains(why, "changed fraction") {
		t.Errorf("big diff: %q", why)
	}
}

// A pinned threshold that no longer describes the pool must refuse to repair,
// however small the id diff — that is the whole meaning of the drift bound.
func TestDriftRefusesARepair(t *testing.T) {
	const n, dim, groups = 300, 64, 10
	vecs := clusteredVectors(n, dim, groups)
	poolIDs := ids(n)
	cfg := defaultClusterConfig()
	cfg.neighbors = knnConfig{k: 8, pcaDims: 0, repairMaxFraction: 0.2, repairMaxDrift: 0.02}

	honest := buildLevelIndex(poolIDs, vecs, cfg).toStored(1)
	if idx, out := levelIndexFor(&honest, poolIDs, vecs, 1, cfg); !out.repaired || idx == nil {
		t.Fatalf("an honest pin with a zero diff did not repair: %+v", out)
	}

	lying := honest
	lying.Threshold = 0.95 // far from anything the pool's distribution says
	if _, out := levelIndexFor(&lying, poolIDs, vecs, 1, cfg); out.repaired || !strings.Contains(out.whyNot, "drift") {
		t.Fatalf("a drifted pin repaired anyway: %+v", out)
	}
}

// A repaired level index must survive the trip through its stored form: the
// round trip compacts tombstones and renames edges by id, and losing anything
// on the way would poison the NEXT rebuild's repair.
func TestStoredIndexRoundTripPreservesClusters(t *testing.T) {
	const n, dim, groups = 400, 128, 20
	vecs := clusteredVectors(n, dim, groups)
	poolIDs := ids(n)
	cfg := defaultClusterConfig()
	cfg.neighbors = knnConfig{k: 32, pcaDims: 16}

	idx := buildLevelIndex(poolIDs, vecs, cfg)
	back := indexFromStored(idx.toStored(1))

	// Same pool order in both, so positions align and results compare directly.
	a, b := idx.cluster(vecs), back.cluster(vecs)
	if a.threshold != b.threshold {
		t.Errorf("threshold changed in the round trip: %v -> %v", a.threshold, b.threshold)
	}
	if len(a.cliques) == 0 {
		t.Fatal("no cliques formed; the round trip proved nothing")
	}
	if len(a.cliques) != len(b.cliques) {
		t.Fatalf("clique count changed in the round trip: %d -> %d", len(a.cliques), len(b.cliques))
	}
	for i := range a.cliques {
		if len(a.cliques[i]) != len(b.cliques[i]) {
			t.Fatalf("clique %d changed size in the round trip", i)
		}
		for j := range a.cliques[i] {
			if idx.ids[a.cliques[i][j]] != back.ids[b.cliques[i][j]] {
				t.Fatalf("clique %d member %d changed in the round trip", i, j)
			}
		}
	}
}

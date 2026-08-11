package knowledge

// ascent_scope_test.go pins the two halves of the Phase 7 decision that the
// differential gate cannot see, because both loops it froze agreed about them.
//
// THE DECISION: an exact (sub-crossover) level does NOT persist or consult an
// index, and the crossover therefore still decides which pools get incremental
// clustering. Record 0158 has the reasoning and the measurement; the short
// form is that construction is chosen by pool size and maintenance by index
// presence, and letting an index divert a sub-crossover level onto the k-NN
// graph would collapse those two rules into one — the same pool clustering
// exactly on the build that mints the index and sparsely on the repair that
// reads it, with content-addressed ids churning at each transition.
//
// THE COROLLARY: nothing about the repair machinery is corpus-specific any
// more. A source-scoped ascent handed a stored index repairs exactly as the
// corpus tier does. What a source lacks is somewhere to KEEP one — the index
// tables are keyed on (project, level) — which makes source-tier
// incrementality a storage question, not a clustering question.

import (
	"sort"
	"strings"
	"testing"
	"time"
)

// A level whose pool is within the crossover is clustered from the complete
// matrix, and a stored index for that level must change nothing: not the
// nodes, not what comes back to persist, not the outcome log. The index handed
// in here describes the pool EXACTLY — zero inserts, zero removes, an honest
// pin — so it is the most repairable index that could possibly exist. If
// anything ever consults one below the crossover, this is where it shows.
//
// The index and outcome assertions carry the weight, not the node comparison.
// Falsified by letting index presence widen the sparse branch, the NODES came
// back identical — on a tight fixture the two constructions agree cluster for
// cluster (BenchmarkCrossover: agree 1.000) — and only the leaked index and
// the leaked outcome betrayed that the construction had changed underneath.
// That is the shape of the failure: a level silently clustered by the other
// algorithm, on a pool where the two happen to agree, until a pool where they
// do not.
func TestAnExactLevelIgnoresAStoredIndex(t *testing.T) {
	const n, dim, groups = 300, 128, 15
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	vecs := clusteredVectors(n, dim, groups)
	poolIDs := ids(n)

	cfg := defaultClusterConfig()
	cfg.maxPool = n // n > n is false: every level is exact
	cfg.neighbors = knnConfig{k: 32, pcaDims: 16, repairMaxFraction: 0.2, repairMaxDrift: 0.02}

	perfect := buildLevelIndex(poolIDs, vecs, cfg).toStored(1)
	if _, out := levelIndexFor(&perfect, poolIDs, vecs, 1, cfg); !out.repaired {
		t.Fatalf("the index handed in is not even repairable (%s) — the test would prove nothing", out.whyNot)
	}

	scope := ascentScope{projectID: "p", localRefID: "ref"}
	bare := ascend(scope, poolIDs, vecs, cfg, now)
	withIndex := ascend(ascentScope{projectID: "p", localRefID: "ref", stored: []CorpusLevelIndex{perfect}},
		poolIDs, vecs, cfg, now)

	if len(bare.nodes) == 0 {
		t.Fatal("the exact ascent formed no nodes; the comparison proves nothing")
	}
	sameNodes(t, "exact level with a stored index", withIndex.nodes, bare.nodes)
	if withIndex.indexes != nil {
		t.Errorf("an exact ascent handed back %d index(es) to persist; exact levels store none", len(withIndex.indexes))
	}
	if withIndex.outcomes != nil {
		t.Errorf("an exact ascent narrated %d repair outcome(s); it made no repair decision", len(withIndex.outcomes))
	}
	if bare.indexes != nil || bare.outcomes != nil {
		t.Error("an exact ascent with no stored index produced index or outcome state anyway")
	}
}

// The unification's actual payoff, stated as a test: a SOURCE-scoped ascent —
// non-empty localRefID, the tier that had no index awareness at all before
// Phase 7 — repairs a stored level index and reaches the same level-1 clusters
// a full consolidation over the same pool reaches. Identical content-addressed
// ids, which is the same equivalence the corpus tier got in record 0146.
//
// Level 1 is the comparison because level 1 is the level the index exists for;
// the levels above it are exact in both runs and reached from identical
// representatives.
//
// The index it repairs is handed in by the test, because nothing persists one
// for a source yet. That is the point: the capability is scope-independent
// now, and only storage is missing.
func TestASourceScopedAscentRepairsLikeTheCorpusTier(t *testing.T) {
	// dim 256 and groups of 20 under k=32: the regime where the sparse
	// construction reproduces the exact one, so a divergence here is the
	// repair's fault and not the fixture's (see TestRepairedIndexMatchesRebuilt).
	const n, dim, groups = 800, 256, 40
	const offset = 10 // artifacts that leave, and arrive, between the two builds
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	all := clusteredVectors(n, dim, groups)
	allIDs := ids(n)

	cfg := defaultClusterConfig()
	cfg.maxPool = 100 // level 1 crosses into sparse, so an index is in play
	cfg.neighbors = knnConfig{k: 32, pcaDims: 16, repairMaxFraction: 0.2, repairMaxDrift: 0.02}

	// The pool as it stands now, and the index a previous ascent left over a
	// pool offset from it: `offset` artifacts have departed and `offset` have
	// arrived, so the repair does real work in both directions.
	poolIDs, poolVecs := allIDs[:n-offset], all[:n-offset]
	prior := buildLevelIndex(allIDs[offset:], all[offset:], cfg).toStored(1)

	scope := ascentScope{projectID: "p", localRefID: "src-1"}
	repaired := ascend(ascentScope{projectID: "p", localRefID: "src-1", stored: []CorpusLevelIndex{prior}},
		poolIDs, poolVecs, cfg, now)
	consolidated := ascend(scope, poolIDs, poolVecs, cfg, now)

	if len(repaired.outcomes) == 0 || !repaired.outcomes[0].repaired {
		t.Fatalf("the source ascent did not repair: %v", repaired.outcomes)
	}
	if len(consolidated.outcomes) == 0 || consolidated.outcomes[0].repaired {
		t.Fatalf("the control run repaired instead of consolidating: %v", consolidated.outcomes)
	}
	if !strings.Contains(consolidated.outcomes[0].whyNot, "no stored index") {
		t.Errorf("the control consolidated for the wrong reason: %q", consolidated.outcomes[0].whyNot)
	}

	// A sparse source level produces an index just as a corpus level does. It
	// has nowhere to go today; that it exists at all is what makes source-tier
	// incrementality a storage change rather than a clustering one.
	if len(repaired.indexes) == 0 {
		t.Error("a sparse source level handed back no index to persist")
	}

	rep, con := levelIDs(repaired.nodes, 1), levelIDs(consolidated.nodes, 1)
	if len(con) == 0 {
		t.Fatal("the consolidation formed no level-1 clusters; the comparison proves nothing")
	}
	t.Logf("level-1 nodes: repaired %d, consolidated %d", len(rep), len(con))
	if len(rep) != len(con) {
		t.Fatalf("repair formed %d level-1 node(s), consolidation %d", len(rep), len(con))
	}
	for _, id := range con {
		if !containsString(rep, id) {
			t.Errorf("level-1 node %s exists after consolidation but not after repair", id)
		}
	}
}

// levelIDs returns the sorted ids of the nodes at one level.
func levelIDs(nodes []Node, level int) []string {
	var out []string
	for _, n := range nodes {
		if n.Level == level {
			out = append(out, n.ID)
		}
	}
	sort.Strings(out)
	return out
}

func containsString(in []string, want string) bool {
	i := sort.SearchStrings(in, want)
	return i < len(in) && in[i] == want
}

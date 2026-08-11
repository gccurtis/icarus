package knowledge

// ascent_differential_test.go is the gate the Phase 7 collapse was made
// behind. Until then two ascent loops of the same shape existed — `ascend` in
// lattice.go for a source's own forest, and `buildCorpusIndexed` in repair.go
// for the project-wide corpus tier — and the collapse had to reproduce BOTH,
// not merely compile.
//
// Both are kept here, frozen exactly as they were, as differential oracles.
// They are the definition of what the one loop replaced, and the cheapest
// possible answer to "did the unification change anything?" — the failure this
// file prevents is a silent one: a lattice that still builds, still passes its
// unit tests, and quietly groups artifacts differently, churning every
// content-addressed node id in the process (record 0140).
//
// THE MAINTENANCE CONTRACT. These copies do not track the live ascent. A
// future change that deliberately alters clustering will make this test fail;
// that is the point. Update the frozen copy in the same commit, and say in the
// commit message what changed and why the old behaviour is no longer wanted.
// Do not "fix" the oracle to agree with the code without that reasoning — the
// disagreement IS the signal.

import (
	"fmt"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"
)

// ascendPreUnification is lattice.go's `ascend` as of commit ef04a11: the
// source-tier ascent, with no index awareness at all. Its sparse levels build
// a throwaway k-NN graph per level and keep nothing.
func ascendPreUnification(projectID, localRefID string, leafIDs []string, leafVecs [][]float64, cfg clusterConfig, now time.Time) []Node {
	ids := append([]string(nil), leafIDs...)
	vecs := append([][]float64(nil), leafVecs...)
	var nodes []Node

	for level := 1; level <= cfg.maxLevels && len(ids) > 1; level++ {
		var res levelResult
		var coh func(members []int) float64
		if cfg.maxPool > 0 && len(ids) > cfg.maxPool {
			levelVecs := vecs
			res = buildLevelIndex(nil, levelVecs, cfg).cluster(levelVecs)
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
		if len(nextIDs) >= len(ids) {
			break
		}
		ids, vecs = nextIDs, nextVecs
	}
	return nodes
}

// buildCorpusIndexedPreUnification is repair.go's corpus driver as of commit
// ef04a11. It was a method on *Knowledge purely to read k.cluster; the config
// is a parameter here so the oracle needs no capability.
func buildCorpusIndexedPreUnification(projectID string, frontier []FrontierEntry, stored []CorpusLevelIndex, cfg clusterConfig, now time.Time) (corpus []Node, indexes []CorpusLevelIndex, outcomes []repairOutcome) {
	if len(frontier) < 2 {
		return nil, nil, nil
	}
	byLevel := make(map[int]*CorpusLevelIndex, len(stored))
	for i := range stored {
		byLevel[stored[i].Level] = &stored[i]
	}

	ids := make([]string, len(frontier))
	vecs := make([][]float64, len(frontier))
	for i, f := range frontier {
		ids[i] = f.ID
		vecs[i] = f.Vector
	}

	for level := 1; level <= cfg.maxLevels && len(ids) > 1; level++ {
		var res levelResult
		var coh func(members []int) float64
		memberID := func(p int) string { return ids[p] }
		memberVec := func(p int) []float64 { return vecs[p] }

		if cfg.maxPool > 0 && len(ids) > cfg.maxPool {
			idx, outcome := levelIndexFor(byLevel[level], ids, vecs, level, cfg)
			outcomes = append(outcomes, outcome)
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
			indexes = append(indexes, idx.toStored(level))
		} else {
			sims := pairwise(vecs)
			res = buildLevel(sims, cfg)
			coh = func(members []int) float64 { return cohesion(sims, members) }
		}
		if len(res.cliques) == 0 {
			break
		}

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
				ID:        nodeID(projectID, "", level, memberIDs),
				ProjectID: projectID, LocalRefID: "",
				Level: level, Centroid: rep, Count: len(clique),
				Cohesion: coh(clique), MemberIDs: memberIDs, CreatedAt: now,
			}
			corpus = append(corpus, n)
			nextIDs = append(nextIDs, n.ID)
			nextVecs = append(nextVecs, rep)
		}
		for i := range ids {
			if !joined[ids[i]] {
				nextIDs = append(nextIDs, ids[i])
				nextVecs = append(nextVecs, vecs[i])
			}
		}
		if len(nextIDs) >= len(ids) {
			break
		}
		ids, vecs = nextIDs, nextVecs
	}
	return corpus, indexes, outcomes
}

// hierarchicalVectors builds a pool with TWO scales of structure: `supers`
// broad topics, each split into `perSuper` tighter sub-groups, spread apart by
// `spread`. Deterministic, same LCG discipline as clusteredVectors.
//
// It exists because a FLAT fixture cannot exercise more than one level of the
// ascent. clusteredVectors' groups are mutually near-orthogonal, so level 1's
// representatives clear nothing at level 2 and the ascent stops — leaving the
// half of the loop that clusters a pool of centroids, and the orphan carry
// between levels, untested. A differential gate that only ever compares level
// 1 would miss any divergence that needs a second pool to appear.
func hierarchicalVectors(n, dim, supers, perSuper int, spread float64) [][]float64 {
	seed := uint64(0x2545F4914F6CDD1D)
	next := func() float64 {
		seed ^= seed << 13
		seed ^= seed >> 7
		seed ^= seed << 17
		return float64(seed%2000)/1000 - 1 // [-1, 1)
	}
	randomUnit := func() []float64 {
		v := make([]float64, dim)
		for i := range v {
			v[i] = next()
		}
		return normalize(v)
	}
	subs := supers * perSuper
	centres := make([][]float64, subs)
	for s := 0; s < supers; s++ {
		super := randomUnit()
		for g := 0; g < perSuper; g++ {
			off := randomUnit()
			v := make([]float64, dim)
			for i := range v {
				v[i] = super[i] + spread*off[i]
			}
			centres[s*perSuper+g] = normalize(v)
		}
	}
	// Same 1/sqrt(dim) reasoning as clusteredVectors: a fixed absolute
	// perturbation swamps the components of a unit vector at any real
	// dimension, and the fixture stops clustering at all.
	perturb := 0.5 / math.Sqrt(float64(dim))
	out := make([][]float64, n)
	for i := range out {
		c := centres[i%subs]
		v := make([]float64, dim)
		for j := range v {
			v[j] = c[j] + perturb*next()
		}
		out[i] = normalize(v)
	}
	return out
}

// sameNodes compares two node lists as the lattice sees them: order, identity,
// membership, level, count, cohesion and centroid. Nothing is normalized away
// — a node list that differs at all differs, and the message names where.
func sameNodes(t *testing.T, what string, got, want []Node) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d node(s), want %d", what, len(got), len(want))
	}
	for i := range want {
		if reflect.DeepEqual(got[i], want[i]) {
			continue
		}
		t.Fatalf("%s: node %d differs\n got: id=%s level=%d count=%d cohesion=%.6f members=%v\nwant: id=%s level=%d count=%d cohesion=%.6f members=%v",
			what, i,
			got[i].ID, got[i].Level, got[i].Count, got[i].Cohesion, got[i].MemberIDs,
			want[i].ID, want[i].Level, want[i].Count, want[i].Cohesion, want[i].MemberIDs)
	}
}

// levelsOf summarizes an ascent as (level, member-count) pairs, for the "this
// fixture actually exercised something" guards.
func levelsOf(nodes []Node) map[int]int {
	out := map[int]int{}
	for _, n := range nodes {
		out[n.Level]++
	}
	return out
}

// The source tier: the unified ascent must reproduce the pre-unification
// source loop exactly, across the shapes that loop had branches for — an
// all-exact ascent, an ascent whose first level crosses into sparse, the
// over-k regime that takes the verified-neighbourhood fallback, and the
// degenerate pools that never enter the loop at all.
func TestUnifiedAscentMatchesSourceLoop(t *testing.T) {
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		name       string
		n          int
		vecs       func(n int) [][]float64
		cfg        func() clusterConfig
		wantLevels int // fewest distinct levels the fixture must produce, 0 = no floor
	}{
		{
			name: "exact/multi-level", n: 240,
			vecs:       func(n int) [][]float64 { return hierarchicalVectors(n, 128, 6, 8, 0.5) },
			cfg:        func() clusterConfig { c := defaultClusterConfig(); c.maxPool = 1000; return c },
			wantLevels: 3,
		},
		{
			name: "sparse/level-1-crosses", n: 240,
			vecs: func(n int) [][]float64 { return hierarchicalVectors(n, 128, 6, 8, 0.5) },
			cfg: func() clusterConfig {
				c := defaultClusterConfig()
				c.maxPool = 100 // level 1 is sparse, the levels above it are not
				c.neighbors = knnConfig{k: 32, pcaDims: 16}
				return c
			},
			wantLevels: 2,
		},
		{
			name: "sparse/over-k-fallback", n: 300,
			vecs: func(n int) [][]float64 { return clusteredVectors(n, 64, 3) },
			cfg: func() clusterConfig {
				c := defaultClusterConfig()
				c.maxPool = 50 // every level sparse; groups of 100 far over k
				c.neighbors = knnConfig{k: 16, pcaDims: 16}
				return c
			},
			wantLevels: 1,
		},
		{
			name: "degenerate/one-artifact", n: 1,
			vecs: func(n int) [][]float64 { return clusteredVectors(n, 32, 1) },
			cfg:  func() clusterConfig { return defaultClusterConfig() },
		},
		{
			name: "degenerate/two-orthogonal", n: 2,
			vecs: func(n int) [][]float64 { return clusteredVectors(n, 32, 2) },
			cfg:  func() clusterConfig { return defaultClusterConfig() },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			vecs := tc.vecs(tc.n)
			poolIDs := ids(tc.n)
			cfg := tc.cfg()

			want := ascendPreUnification("p", "ref", poolIDs, vecs, cfg, now)
			got := ascend(ascentScope{projectID: "p", localRefID: "ref"}, poolIDs, vecs, cfg, now).nodes

			if tc.wantLevels > 0 && len(levelsOf(want)) < tc.wantLevels {
				t.Fatalf("fixture produced %d level(s), want at least %d — the comparison proves too little",
					len(levelsOf(want)), tc.wantLevels)
			}
			sameNodes(t, tc.name, got, want)
		})
	}
}

// The corpus tier: the same unified ascent, given a scope with no localRefID
// and the project's persisted indexes, must reproduce the pre-unification
// corpus driver exactly — nodes, the indexes it hands back for persistence,
// and the per-level outcomes the operator log is built from.
//
// Every branch of levelIndexFor is covered: no stored index, a stored index
// small enough to repair, one whose pin has drifted, and one whose k no longer
// matches the configuration.
func TestUnifiedAscentMatchesCorpusLoop(t *testing.T) {
	const n, dim, groups = 400, 128, 20
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	all := clusteredVectors(n, dim, groups)
	allIDs := ids(n)

	cfg := defaultClusterConfig()
	cfg.maxPool = 100 // level 1 runs sparse, so an index exists to repair
	cfg.neighbors = knnConfig{k: 32, pcaDims: 16, repairMaxFraction: 0.2, repairMaxDrift: 0.02}

	frontierOf := func(from, to int) []FrontierEntry {
		out := make([]FrontierEntry, 0, to-from)
		for i := from; i < to; i++ {
			out = append(out, FrontierEntry{ID: allIDs[i], Vector: all[i], IsWindow: true})
		}
		return out
	}
	full := frontierOf(0, n)

	// The index a previous rebuild left behind, deliberately offset from the
	// pool it will be repaired against: it holds artifacts 10–399 while the
	// pool is 0–389. Ten artifacts leave (tombstones) and ten arrive (appends),
	// so after the repair NO index position equals its pool position.
	//
	// That offset is the point. An earlier version of this fixture stored a
	// prefix of the same pool, which repairs into an index whose positions
	// happen to line up — and a unified path that confused the two coordinate
	// systems passed anyway. The gate has to make them disagree, or it cannot
	// see the one mistake this collapse was most likely to make.
	prior := buildLevelIndex(allIDs[10:], all[10:], cfg).toStored(1)
	offsetPool := frontierOf(0, n-10)

	// The consolidation cases compare against the full pool, where a fresh
	// build's positions do line up — they are testing the refusal, not the
	// coordinate mapping.
	freshPrior := buildLevelIndex(allIDs[:380], all[:380], cfg).toStored(1)
	drifted := freshPrior
	drifted.Threshold = 0.95 // no longer describes the pool
	kChanged := freshPrior
	kChanged.K = 4

	cases := []struct {
		name         string
		frontier     []FrontierEntry
		stored       []CorpusLevelIndex
		wantRepaired bool
		wantWhyNot   string
	}{
		{name: "no stored index", frontier: full, stored: nil, wantWhyNot: "no stored index"},
		{name: "repair with tombstones and appends", frontier: offsetPool, stored: []CorpusLevelIndex{prior}, wantRepaired: true},
		{name: "drifted pin consolidates", frontier: full, stored: []CorpusLevelIndex{drifted}, wantWhyNot: "drift"},
		{name: "k change consolidates", frontier: full, stored: []CorpusLevelIndex{kChanged}, wantWhyNot: "k changed"},
		{name: "frontier below two", frontier: frontierOf(0, 1), stored: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Fresh copies per side: a repair mutates the index it is handed, and
			// the two runs must not see each other's edits.
			wantNodes, wantIndexes, wantOutcomes := buildCorpusIndexedPreUnification(
				"p", tc.frontier, copyIndexes(tc.stored), cfg, now)

			pool := frontierPool(tc.frontier)
			got := ascend(ascentScope{projectID: "p", stored: copyIndexes(tc.stored)}, pool.ids, pool.vecs, cfg, now)

			if len(tc.frontier) > 1 {
				if len(wantOutcomes) == 0 {
					t.Fatal("no sparse level ran; this fixture exercises nothing the two loops disagreed about")
				}
				if wantOutcomes[0].repaired != tc.wantRepaired {
					t.Fatalf("oracle repaired=%v, want %v (%s)", wantOutcomes[0].repaired, tc.wantRepaired, wantOutcomes[0].whyNot)
				}
				if tc.wantWhyNot != "" && !strings.Contains(wantOutcomes[0].whyNot, tc.wantWhyNot) {
					t.Fatalf("oracle refused for %q, want a reason containing %q", wantOutcomes[0].whyNot, tc.wantWhyNot)
				}
			}

			sameNodes(t, tc.name, got.nodes, wantNodes)
			if !reflect.DeepEqual(got.indexes, wantIndexes) {
				t.Fatalf("%s: persisted indexes differ\n%s", tc.name, indexDiff(got.indexes, wantIndexes))
			}
			if !reflect.DeepEqual(got.outcomes, wantOutcomes) {
				t.Fatalf("%s: outcomes differ\n got: %v\nwant: %v", tc.name, got.outcomes, wantOutcomes)
			}
		})
	}
}

// frontierPool flattens a frontier the way the corpus caller does.
type flatPool struct {
	ids  []string
	vecs [][]float64
}

func frontierPool(frontier []FrontierEntry) flatPool {
	p := flatPool{ids: make([]string, len(frontier)), vecs: make([][]float64, len(frontier))}
	for i, f := range frontier {
		p.ids[i], p.vecs[i] = f.ID, f.Vector
	}
	return p
}

// copyIndexes deep-copies the slices a repair mutates in place, so two runs
// over "the same" stored index really do start from the same state.
func copyIndexes(in []CorpusLevelIndex) []CorpusLevelIndex {
	if in == nil {
		return nil
	}
	out := make([]CorpusLevelIndex, len(in))
	for i, ix := range in {
		out[i] = ix
		out[i].Artifacts = make([]CorpusIndexArtifact, len(ix.Artifacts))
		for j, a := range ix.Artifacts {
			out[i].Artifacts[j] = a
			out[i].Artifacts[j].Edges = append([]CorpusIndexEdge(nil), a.Edges...)
		}
	}
	return out
}

// indexDiff names the first place two persisted index sets disagree, because
// a raw dump of a few hundred artifacts with 32 edges each is unreadable.
func indexDiff(got, want []CorpusLevelIndex) string {
	if len(got) != len(want) {
		return fmt.Sprintf("%d level index(es), want %d", len(got), len(want))
	}
	for i := range want {
		g, w := got[i], want[i]
		switch {
		case g.Level != w.Level:
			return fmt.Sprintf("index %d: level %d, want %d", i, g.Level, w.Level)
		case g.Threshold != w.Threshold:
			return fmt.Sprintf("index %d: threshold %.6f, want %.6f", i, g.Threshold, w.Threshold)
		case g.K != w.K:
			return fmt.Sprintf("index %d: k %d, want %d", i, g.K, w.K)
		case !reflect.DeepEqual(g.Basis, w.Basis):
			return fmt.Sprintf("index %d: the projection basis differs", i)
		case !reflect.DeepEqual(g.Centroids, w.Centroids):
			return fmt.Sprintf("index %d: the IVF centroids differ", i)
		case len(g.Artifacts) != len(w.Artifacts):
			return fmt.Sprintf("index %d: %d artifact(s), want %d", i, len(g.Artifacts), len(w.Artifacts))
		}
		for j := range w.Artifacts {
			if !reflect.DeepEqual(g.Artifacts[j], w.Artifacts[j]) {
				return fmt.Sprintf("index %d: artifact %d (%s) differs: cell %d/%d, %d/%d edge(s)",
					i, j, w.Artifacts[j].ID, g.Artifacts[j].Cell, w.Artifacts[j].Cell,
					len(g.Artifacts[j].Edges), len(w.Artifacts[j].Edges))
			}
		}
	}
	return "no structural difference found, but DeepEqual disagrees"
}

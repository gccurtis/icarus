package knowledge

// repair.go is the policy and the persistence form behind ONE decision the
// ascent makes per sparse level: is this rebuild a LOCAL EVENT (repair the
// stored k-NN index through its cells, keep the pinned threshold) or a
// CONSOLIDATION (build the level in full — refit the basis, re-quantize the
// cells, re-pin the threshold)?
//
// The ascent that asks is in lattice.go, and there is only one of it. This
// file used to carry a second copy of that loop — buildCorpusIndexed, the
// corpus tier's index-aware driver, standing beside a source-tier `ascend`
// that had no idea indexes existed. Phase 7 collapsed them: the loop is
// scope-parameterized, this file kept the policy, and the capability stopped
// depending on which tier was being built.
//
// The decision is measured, not guessed. A level repairs only when BOTH hold:
//
//   - the changed fraction (inserts + removes over the pool) is under
//     repair_max_fraction — past that, repairing costs what building costs;
//   - the pinned threshold's drift from the pool's current percentile is
//     under repair_max_drift — past that, the pin no longer describes the
//     pool and every similarity judgement it gates is suspect.
//
// Everything here leans on content-addressed ids (record 0140): an edited
// source changes only its own window ids, so its root's id changes while
// every untouched root keeps its own — the frontier diff is proportional to
// the edit, at every level of the ascent.

import "fmt"

// repairOutcome narrates what one sparse level did, for the rebuild log.
type repairOutcome struct {
	level     int
	repaired  bool
	inserted  int
	removed   int
	drift     float64
	pool      int
	whyNot    string // reason a full build ran, when repaired is false
	threshold float64
}

func (o repairOutcome) String() string {
	if o.repaired {
		return fmt.Sprintf("level %d: repaired (+%d −%d of %d, drift %.4f, threshold %.3f)",
			o.level, o.inserted, o.removed, o.pool, o.drift, o.threshold)
	}
	return fmt.Sprintf("level %d: built in full (%s; pool %d, threshold %.3f)",
		o.level, o.whyNot, o.pool, o.threshold)
}

// repairDecision decides repair-versus-consolidate for one level, given the
// stored index and the level's current pool. It is a pure function so the
// policy is testable apart from the machinery. A nil decision result means
// "build in full", with the reason.
func repairDecision(stored *CorpusLevelIndex, poolIDs []string, cfg clusterConfig) (inserts, removes int, whyNot string) {
	ncfg := cfg.neighbors
	if stored == nil {
		return 0, 0, "no stored index"
	}
	if ncfg.repairMaxFraction <= 0 {
		return 0, 0, "repair disabled"
	}
	k := ncfg.k
	if k <= 0 {
		k = defaultNeighborK
	}
	if stored.K != k {
		return 0, 0, fmt.Sprintf("k changed (%d stored, %d configured)", stored.K, k)
	}
	dims := ncfg.pcaDims
	if dims < 0 {
		dims = 0
	}
	if (len(stored.Basis) > 0) != (dims > 0) {
		return 0, 0, "projection configuration changed"
	}
	have := make(map[string]bool, len(stored.Artifacts))
	for _, a := range stored.Artifacts {
		have[a.ID] = true
	}
	pool := make(map[string]bool, len(poolIDs))
	for _, id := range poolIDs {
		pool[id] = true
		if !have[id] {
			inserts++
		}
	}
	for _, a := range stored.Artifacts {
		if !pool[a.ID] {
			removes++
		}
	}
	n := len(poolIDs)
	if n == 0 {
		return inserts, removes, "empty pool"
	}
	if frac := float64(inserts+removes) / float64(n); frac > ncfg.repairMaxFraction {
		return inserts, removes, fmt.Sprintf("changed fraction %.3f over %.3f", frac, ncfg.repairMaxFraction)
	}
	return inserts, removes, ""
}

// indexFromStored rehydrates a persisted level index. Positions follow the
// stored artifact order; edges naming ids that no longer exist are dropped —
// the diff will have removed those artifacts anyway.
func indexFromStored(s CorpusLevelIndex) *levelIndex {
	n := len(s.Artifacts)
	x := &levelIndex{
		ids:       make([]string, n),
		pos:       make(map[string]int, n),
		live:      make([]bool, n),
		threshold: s.Threshold,
		k:         s.K,
		basis:     s.Basis,
		centroids: s.Centroids,
		cellOf:    make([]int, n),
		edges:     make([][]neighborEdge, n),
	}
	x.members = make([][]int, len(s.Centroids))
	for i, a := range s.Artifacts {
		x.ids[i] = a.ID
		x.pos[a.ID] = i
		x.live[i] = true
		x.cellOf[i] = a.Cell
		if a.Cell >= 0 && a.Cell < len(x.members) {
			x.members[a.Cell] = append(x.members[a.Cell], i)
		}
	}
	for i, a := range s.Artifacts {
		for _, e := range a.Edges {
			if to, ok := x.pos[e.To]; ok {
				x.edges[i] = append(x.edges[i], neighborEdge{to: to, sim: e.Sim})
			}
		}
	}
	return x
}

// toStored flattens a level index for persistence: live members only, in
// position order, with edges named by artifact id. Tombstones compact away
// here, so every consolidation-or-repair cycle stores a clean index.
func (x *levelIndex) toStored(level int) CorpusLevelIndex {
	out := CorpusLevelIndex{
		Level: level, Threshold: x.threshold, K: x.k,
		Basis: x.basis, Centroids: x.centroids,
	}
	for p, id := range x.ids {
		if !x.live[p] {
			continue
		}
		a := CorpusIndexArtifact{ID: id, Cell: x.cellOf[p]}
		for _, e := range x.edges[p] {
			a.Edges = append(a.Edges, CorpusIndexEdge{To: x.ids[e.to], Sim: e.sim})
		}
		out.Artifacts = append(out.Artifacts, a)
	}
	return out
}

// levelIndexFor returns the index one sparse level clusters over: the stored
// one repaired, when the diff is small and the pin honest, or a fresh build.
func levelIndexFor(stored *CorpusLevelIndex, ids []string, vecs [][]float64, level int, cfg clusterConfig) (*levelIndex, repairOutcome) {
	inserts, removes, whyNot := repairDecision(stored, ids, cfg)
	outcome := repairOutcome{level: level, inserted: inserts, removed: removes, pool: len(ids)}
	if whyNot == "" {
		idx := indexFromStored(*stored)
		drift := idx.drift(vecs, cfg)
		outcome.drift = drift
		maxDrift := cfg.neighbors.repairMaxDrift
		if drift <= maxDrift {
			pool := make(map[string]bool, len(ids))
			byID := make(map[string][]float64, len(ids))
			for i, id := range ids {
				pool[id] = true
				byID[id] = vecs[i]
			}
			// Removes first, so a re-minted artifact never scores against a
			// departed one; then inserts, in pool order, each seeing the pool
			// as repaired so far.
			for p, id := range idx.ids {
				if idx.live[p] && !pool[id] {
					idx.remove(id)
				}
			}
			vecAt := func(p int) []float64 {
				if !idx.live[p] {
					return nil
				}
				return byID[idx.ids[p]]
			}
			for _, id := range ids {
				if _, ok := idx.pos[id]; !ok {
					idx.insert(id, byID[id], vecAt)
				}
			}
			outcome.repaired = true
			outcome.threshold = idx.threshold
			return idx, outcome
		}
		whyNot = fmt.Sprintf("drift %.4f over %.4f", drift, maxDrift)
	}
	outcome.whyNot = whyNot
	idx := buildLevelIndex(ids, vecs, cfg)
	outcome.threshold = idx.threshold
	return idx, outcome
}

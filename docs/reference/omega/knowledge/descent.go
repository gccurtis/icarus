package knowledge

// descent.go is directed lattice descent: the best-first walk from the entry
// frontier toward a query vector, bounded by a similarity threshold, a beam and
// a hard expansion backstop, plus the small max-first priority queue it pops
// from. It is the pruned alternative to scanning every window.

import (
	"math"
	"sort"
)

// descend walks the lattice best-first from the entry frontier toward the
// query: a global priority queue pops the most promising node, its children are
// scored, the top beam node-children clearing the threshold are pushed, and
// window children clearing it become candidates. The frontier is derived — the
// artifacts (either tier) that are no node's member — and, because the lattice
// is a DAG, a visited set keeps overlapping parents from re-expanding shared
// members. Bounded by the threshold, the beam, and a hard expansion backstop.
func (k *Knowledge) descend(projectID string, q []float64) ([]Window, error) {
	frontier, err := k.entryFrontier(projectID, q)
	if err != nil {
		return nil, err
	}

	pq := &scoreQueue{}
	candIDs := map[string]struct{}{}
	frontierIDs := map[string]bool{}
	var frontierNodes []string
	for _, f := range frontier {
		if f.ID == "" || frontierIDs[f.ID] || !validRetrievalVector(f.Vector, len(q)) {
			return nil, ErrEvidenceCorrupt
		}
		frontierIDs[f.ID] = true
		if s := dot(q, f.Vector); s >= k.descentThreshold {
			if f.IsWindow {
				candIDs[f.ID] = struct{}{}
			} else {
				pq.push(scoredID{f.ID, s})
				frontierNodes = append(frontierNodes, f.ID)
			}
		}
	}

	// nodeByID caches the nodes we have loaded so far; it grows one expansion's
	// worth of children at a time, never the whole lattice.
	nodeByID := map[string]Node{}
	seed, err := k.store.NodesByID(frontierNodes)
	if err != nil {
		return nil, err
	}
	if len(seed) != len(frontierNodes) {
		return nil, ErrEvidenceCorrupt
	}
	for _, n := range seed {
		if _, exists := nodeByID[n.ID]; exists || !validDescentNode(n, projectID, len(q)) {
			return nil, ErrEvidenceCorrupt
		}
		nodeByID[n.ID] = n
	}

	visited := map[string]bool{}
	expanded := 0
	for pq.len() > 0 && expanded < maxDescentExpansions {
		cur := pq.pop()
		if visited[cur.id] {
			continue
		}
		visited[cur.id] = true
		n, ok := nodeByID[cur.id]
		if !ok {
			return nil, ErrEvidenceCorrupt
		}
		expanded++

		// A member is either a window or a lower node; probe windows first, the
		// rest are nodes. Both are batch loads, so one expansion is two reads.
		wins, err := k.store.WindowsByID(n.MemberIDs)
		if err != nil {
			return nil, err
		}
		isWindow := make(map[string]bool, len(wins))
		for _, w := range wins {
			if !containsID(n.MemberIDs, w.ID) || isWindow[w.ID] ||
				w.ID == "" || !validRetrievalVector(w.Embedding, len(q)) {
				return nil, ErrEvidenceCorrupt
			}
			isWindow[w.ID] = true
			if dot(q, w.Embedding) >= k.descentThreshold {
				candIDs[w.ID] = struct{}{}
			}
		}
		var nodeMembers []string
		for _, m := range n.MemberIDs {
			if !isWindow[m] {
				nodeMembers = append(nodeMembers, m)
			}
		}
		childNodes, err := k.store.NodesByID(nodeMembers)
		if err != nil {
			return nil, err
		}
		if len(childNodes) != len(nodeMembers) {
			return nil, ErrEvidenceCorrupt
		}
		kids := make([]scoredID, 0, len(childNodes))
		seenChildren := map[string]bool{}
		for _, cn := range childNodes {
			if seenChildren[cn.ID] || !validDescentNode(cn, projectID, len(q)) {
				return nil, ErrEvidenceCorrupt
			}
			seenChildren[cn.ID] = true
			nodeByID[cn.ID] = cn
			if s := dot(q, cn.Centroid); s >= k.descentThreshold {
				kids = append(kids, scoredID{cn.ID, s})
			}
		}
		sort.Slice(kids, func(i, j int) bool {
			if kids[i].score != kids[j].score {
				return kids[i].score > kids[j].score
			}
			return kids[i].id < kids[j].id
		})
		if len(kids) > k.descentBeam {
			kids = kids[:k.descentBeam]
		}
		for _, kid := range kids {
			pq.push(kid)
		}
	}

	// Materialize the candidate windows in one final batch.
	ids := make([]string, 0, len(candIDs))
	for id := range candIDs {
		ids = append(ids, id)
	}
	windows, err := k.store.WindowsByID(ids)
	if err != nil {
		return nil, err
	}
	if len(windows) != len(ids) {
		return nil, ErrEvidenceCorrupt
	}
	seenWindows := map[string]bool{}
	for _, window := range windows {
		if _, ok := candIDs[window.ID]; !ok || seenWindows[window.ID] ||
			!validRetrievalVector(window.Embedding, len(q)) {
			return nil, ErrEvidenceCorrupt
		}
		seenWindows[window.ID] = true
	}
	return windows, nil
}

func validRetrievalVector(vector []float64, dimensions int) bool {
	if len(vector) != dimensions {
		return false
	}
	for _, component := range vector {
		if math.IsNaN(component) || math.IsInf(component, 0) {
			return false
		}
	}
	return true
}

func validDescentNode(node Node, projectID string, dimensions int) bool {
	if node.ID == "" || node.ProjectID != projectID || node.Level <= 0 ||
		node.Count != len(node.MemberIDs) || len(node.MemberIDs) == 0 ||
		!validRetrievalVector(node.Centroid, dimensions) {
		return false
	}
	seen := map[string]bool{}
	for _, memberID := range node.MemberIDs {
		if memberID == "" || memberID == node.ID || seen[memberID] {
			return false
		}
		seen[memberID] = true
	}
	return true
}

func containsID(ids []string, want string) bool {
	for _, id := range ids {
		if id == want {
			return true
		}
	}
	return false
}

// validateArtifactGraph walks every source-tier artifact from the derived
// frontier. It is used by the promotion gate, where sampling is insufficient:
// every declared member must resolve to exactly one window or lower-level node,
// and all vectors must belong to the target dimension.
func (k *Knowledge) validateArtifactGraph(projectID string, dimensions int) error {
	frontier, err := k.store.SourceFrontier(projectID)
	if err != nil {
		return err
	}
	seenFrontier := map[string]bool{}
	var pending []string
	for _, entry := range frontier {
		if entry.ID == "" || seenFrontier[entry.ID] ||
			!validRetrievalVector(entry.Vector, dimensions) {
			return ErrEvidenceCorrupt
		}
		seenFrontier[entry.ID] = true
		if entry.IsWindow {
			windows, err := k.store.WindowsByID([]string{entry.ID})
			if err != nil {
				return err
			}
			if len(windows) != 1 || windows[0].ID != entry.ID ||
				!validRetrievalVector(windows[0].Embedding, dimensions) {
				return ErrEvidenceCorrupt
			}
		} else {
			pending = append(pending, entry.ID)
		}
	}

	visited := map[string]bool{}
	for len(pending) > 0 {
		nodeID := pending[0]
		pending = pending[1:]
		if visited[nodeID] {
			continue
		}
		nodes, err := k.store.NodesByID([]string{nodeID})
		if err != nil {
			return err
		}
		if len(nodes) != 1 || nodes[0].ID != nodeID ||
			!validDescentNode(nodes[0], projectID, dimensions) {
			return ErrEvidenceCorrupt
		}
		node := nodes[0]
		visited[nodeID] = true

		windows, err := k.store.WindowsByID(node.MemberIDs)
		if err != nil {
			return err
		}
		children, err := k.store.NodesByID(node.MemberIDs)
		if err != nil {
			return err
		}
		windowByID := make(map[string]Window, len(windows))
		for _, window := range windows {
			if _, exists := windowByID[window.ID]; exists ||
				!validRetrievalVector(window.Embedding, dimensions) {
				return ErrEvidenceCorrupt
			}
			windowByID[window.ID] = window
		}
		nodeByID := make(map[string]Node, len(children))
		for _, child := range children {
			if _, exists := nodeByID[child.ID]; exists ||
				!validDescentNode(child, projectID, dimensions) ||
				child.Level >= node.Level {
				return ErrEvidenceCorrupt
			}
			nodeByID[child.ID] = child
		}
		for _, memberID := range node.MemberIDs {
			_, isWindow := windowByID[memberID]
			child, isNode := nodeByID[memberID]
			if isWindow == isNode {
				return ErrEvidenceCorrupt
			}
			if isNode && !visited[child.ID] {
				pending = append(pending, child.ID)
			}
		}
	}
	return nil
}

// entryFrontier is where the probe lands. The mechanics carry no flag: when a
// level-1 corpus index is stored, the query is projected through its basis and
// only the nearest cells' members are loaded — plus everything the index does
// not cover, because the probe may narrow the indexed mass (the orphan bulk
// that makes a frontier large) but never hide corpus roots or artifacts
// written since the index was stored. A project with no stored index — one
// whose corpus clusters exactly, under the crossover — gets the full scan,
// which at that size is both exact and cheap. Presence of the index IS the
// decision, exactly as pool size is the decision between the exact and sparse
// clustering constructions.
func (k *Knowledge) entryFrontier(projectID string, q []float64) ([]FrontierEntry, error) {
	hdr, ok, err := k.store.CorpusIndexHeader(projectID, 1)
	if err != nil {
		return nil, err
	}
	if !ok || len(hdr.Centroids) == 0 {
		return k.store.EntryFrontier(projectID)
	}
	p := q
	if len(hdr.Basis) > 0 {
		p = project(hdr.Basis, q)
	}
	return k.store.EntryFrontierProbed(projectID, 1, nearestCells(p, hdr.Centroids, probeCells))
}

// scoredID and scoreQueue form the minimal max-first priority queue descent
// pops from: a binary heap ordered by score, id-tie-broken for determinism.
type scoredID struct {
	id    string
	score float64
}

type scoreQueue struct{ items []scoredID }

func (pq *scoreQueue) len() int { return len(pq.items) }

func (pq *scoreQueue) less(i, j int) bool {
	if pq.items[i].score != pq.items[j].score {
		return pq.items[i].score > pq.items[j].score
	}
	return pq.items[i].id < pq.items[j].id
}

func (pq *scoreQueue) push(s scoredID) {
	pq.items = append(pq.items, s)
	i := len(pq.items) - 1
	for i > 0 {
		parent := (i - 1) / 2
		if !pq.less(i, parent) {
			break
		}
		pq.items[i], pq.items[parent] = pq.items[parent], pq.items[i]
		i = parent
	}
}

func (pq *scoreQueue) pop() scoredID {
	top := pq.items[0]
	last := len(pq.items) - 1
	pq.items[0] = pq.items[last]
	pq.items = pq.items[:last]
	i := 0
	for {
		l, r := 2*i+1, 2*i+2
		best := i
		if l < len(pq.items) && pq.less(l, best) {
			best = l
		}
		if r < len(pq.items) && pq.less(r, best) {
			best = r
		}
		if best == i {
			break
		}
		pq.items[i], pq.items[best] = pq.items[best], pq.items[i]
		i = best
	}
	return top
}

package knowledge

// corpus.go maintains the cross-source tier, off the write path.
//
// A write drops the corpus tier and bumps the project's dirty sequence; nothing
// rebuilds it synchronously. That split exists because the rebuild is O(F²) in
// the project's whole frontier — 7.8s at 4,000 artifacts — and running it inside
// the write transaction meant every other write in the project waited on it.
//
// Between the drop and the rebuild there is simply no corpus tier, which
// retrieval already handles by entering at the source frontiers. That is a
// deliberate choice over leaving the old tier in place: the write that dropped it
// may have deleted the very nodes and windows the old tier pointed at, and
// descent following a corpus root into dangling members returns less while
// looking like it worked.

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

// JobTypeRebuildCorpus is the background job that rebuilds one project's corpus
// tier.
const JobTypeRebuildCorpus = "knowledge.corpus.rebuild"

// rebuildPayload is the JSON payload of a JobTypeRebuildCorpus job.
type rebuildPayload struct {
	ProjectID string `json:"projectId"`
}

// queueCorpusRebuild schedules a rebuild for the project. It is best-effort by
// design: the corpus tier is an optimization over the source frontiers, so a
// failure to schedule degrades retrieval rather than failing the write that
// triggered it. The dirty sequence is already persisted, so a later write (or a
// sweep) still picks the project up.
func (k *Knowledge) queueCorpusRebuild(projectID string) {
	if k.enqueuer == nil {
		return
	}
	if _, err := k.enqueuer.Enqueue(context.Background(), JobTypeRebuildCorpus, rebuildPayload{ProjectID: projectID}); err != nil {
		k.log.Warnf("knowledge: could not schedule a corpus rebuild for project %s: %v — retrieval will enter at the source frontiers until one runs", projectID, err)
	}
}

// RebuildCorpusJob is the job.Handler for JobTypeRebuildCorpus.
func (k *Knowledge) RebuildCorpusJob(ctx context.Context, payload json.RawMessage) error {
	var p rebuildPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}
	return k.RebuildCorpus(ctx, p.ProjectID)
}

// RebuildCorpus recomputes the project's corpus tier from the current frontier.
//
// It is idempotent and cheap when there is nothing to do, which is what makes
// over-scheduling harmless: several writes in a row may each queue a job, and
// every job after the first finds the tier already current and returns without
// reading a vector.
//
// The clustering deliberately runs OUTSIDE any transaction. The sequence is read
// first and handed back to the store with the result, so a write landing during
// the computation pushes the dirty sequence past what this rebuild claims — the
// tier is stored, the project still reads as stale, and the next job picks it up.
// Nothing is lost and no write waited.
func (k *Knowledge) RebuildCorpus(_ context.Context, projectID string) error {
	if k.generations != nil {
		token, _, _, err := k.generations.Active(projectID, LatticeText)
		if errors.Is(err, ErrEmbeddingSpaceUnavailable) {
			return nil
		}
		if err != nil {
			return err
		}
		view := *k
		view.store = k.generations.ForGeneration(token.GenerationID)
		view.generations = nil
		view.generationID = token.GenerationID
		return view.RebuildCorpus(context.Background(), projectID)
	}
	dirty, built, err := k.store.CorpusSeq(projectID)
	if err != nil {
		return err
	}
	if dirty == built {
		return nil
	}
	// Timed in two halves, because they fail differently and are fixed
	// differently: loading is I/O and vector decoding (linear in the frontier),
	// clustering is the ascent. A rebuild that has become slow is a different
	// problem depending on which half grew, and without the split the only
	// signal is one number that says "slow".
	loadStart := time.Now()
	frontier, err := k.store.SourceFrontier(projectID)
	if err != nil {
		return err
	}
	stored, err := k.store.CorpusIndexes(projectID)
	if err != nil {
		return err
	}
	loadTook := time.Since(loadStart)

	// The corpus tier is the ascent with an empty localRefID and the project's
	// persisted level indexes — the same function a source's own forest is built
	// by (lattice.go), differing only in what it is scoped to and what it starts
	// from.
	ids := make([]string, len(frontier))
	vecs := make([][]float64, len(frontier))
	for i, f := range frontier {
		ids[i], vecs[i] = f.ID, f.Vector
	}
	clusterStart := time.Now()
	ascent := ascend(ascentScope{projectID: projectID, stored: stored}, ids, vecs, k.cluster, k.now().UTC())
	clusterTook := time.Since(clusterStart)

	// One line per sparse level — the operator's answer to "was that write a
	// local event or a consolidation, and why".
	for _, o := range ascent.outcomes {
		k.log.Infof("knowledge: corpus for project %s, %s", projectID, o)
	}
	k.log.Infof("knowledge: rebuilt the corpus tier for project %s — %d frontier entries in %s (load %s, cluster %s), %d node(s)",
		projectID, len(frontier), (loadTook + clusterTook).Round(time.Millisecond),
		loadTook.Round(time.Millisecond), clusterTook.Round(time.Millisecond), len(ascent.nodes))

	_, err = k.store.AdmitCorpus(projectID, k.maxArtifacts, ascent.nodes, dirty, ascent.indexes)
	return err
}

// CorpusCurrent reports whether the project's corpus tier reflects every write.
// It exists for tests and for an operator asking whether a rebuild is pending.
func (k *Knowledge) CorpusCurrent(projectID string) (bool, error) {
	if k.generations != nil {
		token, _, _, err := k.generations.Active(projectID, LatticeText)
		if errors.Is(err, ErrEmbeddingSpaceUnavailable) {
			return true, nil
		}
		if err != nil {
			return false, err
		}
		dirty, built, err := k.generations.ForGeneration(token.GenerationID).CorpusSeq(projectID)
		return dirty == built, err
	}
	dirty, built, err := k.store.CorpusSeq(projectID)
	if err != nil {
		return false, err
	}
	return dirty == built, nil
}

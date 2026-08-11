package sqlite

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

var _ knowledge.GenerationStore = (*Store)(nil)

func openKnowledgeGenerationStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(filepath.Join(t.TempDir(), "generation.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func generationTestSpace(model string) knowledge.EmbeddingSpace {
	return knowledge.SpaceForIdentity(knowledge.VectorIdentity{Provider: "test", Model: model, Dims: 2})
}

func ensureGenerationTestActive(t *testing.T, store *Store, projectID string) (knowledge.ReadToken, knowledge.LatticeGeneration) {
	t.Helper()
	now := time.Date(2026, 7, 30, 10, 0, 0, 0, time.UTC)
	generation := knowledge.LatticeGeneration{ID: projectID + "-generation-1", CreatedAt: now}
	token, active, err := store.EnsureActive(projectID, knowledge.LatticeText, generation, generationTestSpace("one"))
	if err != nil {
		t.Fatal(err)
	}
	return token, active
}

func generationTestWrite(projectID, sourceID, hash string, revision int64) knowledge.SourceWrite {
	return knowledge.SourceWrite{Source: knowledge.Source{
		LocalRefID: projectID + "-" + sourceID, ProjectID: projectID,
		SourceType: knowledge.SourceTypeDocument, SourceID: sourceID,
		SizeBytes: len(hash), ContentHash: hash, Identity: generationTestSpace("one").VectorIdentity(),
		AddedAt:  time.Date(2026, 7, 30, 10, 0, 0, 0, time.UTC),
		SyncedAt: time.Date(2026, 7, 30, 10, 0, 0, 0, time.UTC), Revision: revision,
	}}
}

func TestSQLiteActiveWritesAdvanceDurableCursorWithoutSourceCursorCAS(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	token, _ := ensureGenerationTestActive(t, store, "project-one")
	at := time.Date(2026, 7, 30, 11, 0, 0, 0, time.UTC)

	drifted := generationTestWrite("project-one", "drifted", "wrong-space", 1)
	drifted.Source.Identity = generationTestSpace("two").VectorIdentity()
	if _, _, err := store.AdmitAndReplaceActive(token, 100, []knowledge.SourceWrite{drifted}, at); !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
		t.Fatalf("ordinary identity drift error = %v", err)
	}
	_, first, err := store.AdmitAndReplaceActive(
		token, 100, []knowledge.SourceWrite{generationTestWrite("project-one", "one", "hash-one", 1)}, at)
	if err != nil {
		t.Fatal(err)
	}
	// The caller's source cursor is intentionally stale. Active generation and
	// state revision are the write CAS; the transaction reads the latest cursor.
	_, second, err := store.AdmitAndReplaceActive(
		token, 100, []knowledge.SourceWrite{generationTestWrite("project-one", "two", "hash-two", 2)}, at.Add(time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if first.SourceCursor != 1 || second.SourceCursor != 2 {
		t.Fatalf("cursors = %d, %d; want 1, 2", first.SourceCursor, second.SourceCursor)
	}
	removed, third, err := store.DeleteActive(token, knowledge.SourceTypeDocument, "one", at.Add(2*time.Second))
	if err != nil || !removed || third.SourceCursor != 3 {
		t.Fatalf("delete = removed %v cursor %d err %v", removed, third.SourceCursor, err)
	}
	changes, err := store.SourceChangesAfter("project-one", knowledge.LatticeText, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 3 || changes[0].Operation != knowledge.SourceAdded ||
		changes[1].Operation != knowledge.SourceAdded || changes[2].Operation != knowledge.SourceRemoved ||
		changes[2].SourceID != "one" || changes[2].ContentHash != "hash-one" {
		t.Fatalf("changes = %+v", changes)
	}
	current, err := store.Current(first)
	if err != nil || current {
		t.Fatalf("stale read token current = %v, %v", current, err)
	}
}

func TestSQLiteArtifactViewsIsolateSameContentDerivedIDs(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	token, _ := ensureGenerationTestActive(t, store, "project-one")
	active := store.ForGeneration(token.GenerationID)
	shadow := store.ForGeneration("project-one-shadow")

	activeWrite := generationTestWrite("project-one", "same", "active-hash", 1)
	shadowWrite := generationTestWrite("project-one", "same", "shadow-hash", 2)
	if err := active.ReplaceSources([]knowledge.SourceWrite{activeWrite}); err != nil {
		t.Fatal(err)
	}
	if err := shadow.ReplaceSources([]knowledge.SourceWrite{shadowWrite}); err != nil {
		t.Fatal(err)
	}
	activeSource, ok, err := active.SourceByOrigin("project-one", knowledge.SourceTypeDocument, "same")
	if err != nil || !ok {
		t.Fatalf("active source: %+v, %v, %v", activeSource, ok, err)
	}
	shadowSource, ok, err := shadow.SourceByOrigin("project-one", knowledge.SourceTypeDocument, "same")
	if err != nil || !ok {
		t.Fatalf("shadow source: %+v, %v, %v", shadowSource, ok, err)
	}
	if activeSource.ContentHash != "active-hash" || shadowSource.ContentHash != "shadow-hash" {
		t.Fatalf("cross-generation read: active=%q shadow=%q",
			activeSource.ContentHash, shadowSource.ContentHash)
	}
}

func TestSQLiteCheckpointPersistsUsageBeforePolicyFailure(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	token, initial := ensureGenerationTestActive(t, store, "project-one")
	now := time.Date(2026, 7, 30, 11, 30, 0, 0, time.UTC)
	preview := knowledge.ReembedPreview{
		ID: "preview-usage", ProjectID: "project-one", Kind: knowledge.LatticeText,
		FromGenerationID: initial.ID, FromSpace: generationTestSpace("one"),
		ToSpace: generationTestSpace("two"), ExpectedStateRevision: token.StateRevision,
		SourceCursor: token.SourceCursor, Sources: 1,
		Policy:    knowledge.ReembedPolicy{MaxRequests: 1, MaxCostUSD: 0.1},
		CreatedBy: "owner", CreatedAt: now, ExpiresAt: now.Add(time.Hour),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run, _, err := store.StartReembed(preview.ID,
		knowledge.ReembedRun{ID: "run-usage", IdempotencyKey: "usage-key", ActorID: "owner", CreatedAt: now},
		knowledge.LatticeGeneration{ID: "generation-usage", CreatedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if run, _, err = store.ClaimReembed(run.ID, now); err != nil {
		t.Fatal(err)
	}
	checkpoint := knowledge.ReembedCheckpoint{
		SourceType: knowledge.SourceTypeDocument, SourceID: "one", Status: "skipped",
		Usage: knowledge.Usage{PromptTokens: 7, TotalTokens: 9, Requests: 2, CostUSD: 0.25},
	}
	run, err = store.CommitReembedCheckpoint(run.ID, checkpoint, nil, 100, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("over-policy receipt must commit before the service fails the run: %v", err)
	}
	if run.Usage.Requests != 2 || run.Usage.CostUSD != 0.25 ||
		run.Usage.PromptTokens != 7 || run.Usage.TotalTokens != 9 {
		t.Fatalf("durable usage totals = %+v", run.Usage)
	}
	checkpoints, err := store.ReembedCheckpoints(run.ID)
	if err != nil || len(checkpoints) != 1 || checkpoints[0].Usage != checkpoint.Usage {
		t.Fatalf("durable checkpoint = %+v, %v", checkpoints, err)
	}
	failed := checkpoint
	failed.Status = "failed"
	failed.LastError = "knowledge.reembed_incomplete"
	failed.Usage = knowledge.Usage{PromptTokens: 3, TotalTokens: 3, Requests: 1, CostUSD: 0.02}
	run, err = store.CommitReembedCheckpoint(run.ID, failed, nil, 100, now.Add(2*time.Minute))
	if err != nil {
		t.Fatalf("failed source receipt: %v", err)
	}
	checkpoints, err = store.ReembedCheckpoints(run.ID)
	if err != nil || len(checkpoints) != 1 || checkpoints[0].Status != "failed" ||
		checkpoints[0].LastError != failed.LastError || run.SourcesSkipped != 0 ||
		run.Usage != failed.Usage {
		t.Fatalf("failed receipt/totals = run %+v checkpoints %+v err %v", run, checkpoints, err)
	}
}

func TestSQLitePromotionRollbackAndRecoveryAreAtomic(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	token, initial := ensureGenerationTestActive(t, store, "project-one")
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	preview := knowledge.ReembedPreview{
		ID: "preview-one", ProjectID: "project-one", Kind: knowledge.LatticeText,
		FromGenerationID: initial.ID, FromSpace: generationTestSpace("one"), ToSpace: generationTestSpace("two"),
		ExpectedStateRevision: token.StateRevision, SourceCursor: token.SourceCursor,
		CreatedBy: "owner", CreatedAt: now, ExpiresAt: now.Add(time.Hour),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run := knowledge.ReembedRun{ID: "run-one", IdempotencyKey: "key-one", ActorID: "owner", CreatedAt: now}
	target := knowledge.LatticeGeneration{ID: "generation-two", CreatedBy: "owner", CreatedAt: now}
	run, existed, err := store.StartReembed(preview.ID, run, target)
	if err != nil || existed {
		t.Fatalf("start = %+v, existed %v, err %v", run, existed, err)
	}
	if _, claimed, err := store.ClaimReembed(run.ID, now); err != nil || !claimed {
		t.Fatalf("claim = %v, %v", claimed, err)
	}
	recovered, err := store.RecoverReembeds(now.Add(time.Minute))
	if err != nil || len(recovered) != 1 || recovered[0].Status != knowledge.ReembedQueued {
		t.Fatalf("recover = %+v, %v", recovered, err)
	}
	if _, claimed, err := store.ClaimReembed(run.ID, now.Add(2*time.Minute)); err != nil || !claimed {
		t.Fatalf("reclaim = %v, %v", claimed, err)
	}
	validation := knowledge.Validation{
		Complete: true, SpaceIdentity: preview.ToSpace.Identity(),
		SourceWatermark: token.SourceCursor, ValidatedAt: now.Add(3 * time.Minute),
	}
	if _, err := store.MarkReembedReady(run.ID, token.SourceCursor, validation, nil, nil, now.Add(3*time.Minute)); err != nil {
		t.Fatal(err)
	}
	state, err := store.PromoteReembed(
		"project-one", run.ID, "owner", token.StateRevision,
		now.Add(time.Hour), now.Add(4*time.Minute))
	if err != nil || state.ActiveGenerationID != target.ID || state.Revision != token.StateRevision+1 {
		t.Fatalf("promote = %+v, %v", state, err)
	}
	rolled, err := store.RollbackGeneration(
		"project-one", knowledge.LatticeText, "owner", state.Revision, now.Add(5*time.Minute))
	if err != nil || rolled.ActiveGenerationID != initial.ID {
		t.Fatalf("rollback = %+v, %v", rolled, err)
	}
	events, err := store.GenerationEvents("project-one", 0, 10)
	if err != nil || len(events) != 2 || events[0].Type != "promoted" || events[1].Type != "rolled_back" {
		t.Fatalf("events = %+v, %v", events, err)
	}
	if _, err := store.RollbackGeneration(
		"project-one", knowledge.LatticeText, "owner", rolled.Revision-1, now); !errors.Is(err, knowledge.ErrGenerationConflict) {
		t.Fatalf("stale rollback error = %v", err)
	}
}

func TestSQLiteReembedCanCatchUpRemovalBeforeADeletedSourceCheckpoint(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	token, initial := ensureGenerationTestActive(t, store, "project-remove")
	now := time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)
	_, current, err := store.AdmitAndReplaceActive(token, 100, []knowledge.SourceWrite{
		generationTestWrite("project-remove", "one", "hash-one", 1),
		generationTestWrite("project-remove", "two", "hash-two", 1),
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	preview := knowledge.ReembedPreview{
		ID: "preview-remove", ProjectID: "project-remove", Kind: knowledge.LatticeText,
		FromGenerationID: initial.ID, FromSpace: generationTestSpace("one"),
		ToSpace: generationTestSpace("two"), ExpectedStateRevision: current.StateRevision,
		SourceCursor: current.SourceCursor, Sources: 2,
		CreatedBy: "owner", CreatedAt: now, ExpiresAt: now.Add(time.Hour),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run, _, err := store.StartReembed(
		preview.ID,
		knowledge.ReembedRun{ID: "run-remove", IdempotencyKey: "remove-key", ActorID: "owner", CreatedAt: now},
		knowledge.LatticeGeneration{ID: "generation-remove", CreatedAt: now},
	)
	if err != nil {
		t.Fatal(err)
	}
	run, claimed, err := store.ClaimReembed(run.ID, now)
	if err != nil || !claimed {
		t.Fatalf("claim = %+v, %v, %v", run, claimed, err)
	}
	write := generationTestWrite("project-remove", "one", "hash-one", 1)
	write.Source.Identity = preview.ToSpace.VectorIdentity()
	write.Source.SizeBytes = 4
	write.Windows = []knowledge.Window{{
		ID: "window-one", LocalRefID: write.Source.LocalRefID,
		Start: 0, End: 4, Text: "text", Embedding: []float64{1, 0},
	}}
	checkpoint := knowledge.ReembedCheckpoint{
		SourceType: knowledge.SourceTypeDocument, SourceID: "one",
		Revision: 1, ContentHash: "hash-one", Status: "complete",
	}
	if _, err := store.CommitReembedCheckpoint(run.ID, checkpoint, &write, 100, now); err != nil {
		t.Fatal(err)
	}
	removed, current, err := store.DeleteActive(
		current, knowledge.SourceTypeDocument, "two", now.Add(time.Minute),
	)
	if err != nil || !removed {
		t.Fatalf("delete = %v, %v", removed, err)
	}
	validation := knowledge.Validation{
		Complete: true, SourceCount: 1, WindowCount: 1, ArtifactCount: 1, ProbeCount: 1,
		SpaceIdentity: preview.ToSpace.Identity(), SourceWatermark: current.SourceCursor,
		ValidatedAt: now.Add(2 * time.Minute),
	}
	run, err = store.MarkReembedReady(
		run.ID, current.SourceCursor, validation, nil, nil, now.Add(2*time.Minute),
	)
	if err != nil || run.Status != knowledge.ReembedReady || run.SourcesTotal != 1 {
		t.Fatalf("ready after uncheckpointed removal = %+v, %v", run, err)
	}
}

func TestSQLiteLegacyMigrationCertifiesOnlyHomogeneousValidSpaces(t *testing.T) {
	store := openKnowledgeGenerationStore(t)
	for _, table := range []string{
		"knowledge_generation_events", "knowledge_reembed_checkpoints", "knowledge_reembed_runs",
		"knowledge_reembed_previews", "knowledge_source_changes", "knowledge_lattice_state",
		"knowledge_generations", "knowledge_embedding_spaces", "knowledge_memberships",
		"knowledge_corpus_edges", "knowledge_corpus_index", "knowledge_corpus_state",
		"knowledge_windows", "knowledge_nodes", "knowledge_sources",
	} {
		if _, err := store.db.Exec(`DROP TABLE ` + table); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := store.db.Exec(`DROP TABLE IF EXISTS knowledge_legacy_generation_map`); err != nil {
		t.Fatal(err)
	}
	for _, stmt := range []string{
		`CREATE TABLE knowledge_sources (
			local_ref_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_type TEXT NOT NULL,
			source_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', text TEXT NOT NULL,
			size_bytes INTEGER NOT NULL DEFAULT 0, line_count INTEGER NOT NULL DEFAULT 0,
			content_hash TEXT NOT NULL DEFAULT '', blocks TEXT NOT NULL DEFAULT '[]',
			identity TEXT NOT NULL DEFAULT '{}', added_at TEXT NOT NULL, synced_at TEXT NOT NULL,
			revision INTEGER NOT NULL DEFAULT 0, UNIQUE(project_id,source_type,source_id))`,
		`CREATE TABLE knowledge_windows (
			id TEXT PRIMARY KEY, local_ref_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
			win_start INTEGER NOT NULL, win_end INTEGER NOT NULL, embedding TEXT NOT NULL,
			text TEXT NOT NULL DEFAULT '', blocks TEXT NOT NULL DEFAULT '[]', embedding_v2 BLOB)`,
		`CREATE TABLE knowledge_nodes (
			id TEXT PRIMARY KEY, project_id TEXT NOT NULL, local_ref_id TEXT NOT NULL,
			level INTEGER NOT NULL, member_count INTEGER NOT NULL, cohesion REAL NOT NULL,
			centroid TEXT NOT NULL, created_at TEXT NOT NULL, centroid_v2 BLOB)`,
		`CREATE TABLE knowledge_memberships (
			parent_id TEXT NOT NULL, member_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
			PRIMARY KEY(parent_id,ordinal))`,
		`CREATE TABLE knowledge_corpus_state (
			project_id TEXT PRIMARY KEY, dirty_seq INTEGER NOT NULL DEFAULT 0,
			built_seq INTEGER NOT NULL DEFAULT 0)`,
		`CREATE TABLE knowledge_corpus_index (
			project_id TEXT NOT NULL, level INTEGER NOT NULL, threshold REAL NOT NULL,
			k INTEGER NOT NULL, basis BLOB, centroids BLOB, PRIMARY KEY(project_id,level))`,
		`CREATE TABLE knowledge_corpus_edges (
			project_id TEXT NOT NULL, level INTEGER NOT NULL, artifact_id TEXT NOT NULL,
			cell INTEGER NOT NULL, edges BLOB, PRIMARY KEY(project_id,level,artifact_id))`,
	} {
		if _, err := store.db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}

	at := time.Date(2026, 7, 30, 9, 0, 0, 0, time.UTC).Format(timeLayout)
	one, _ := json.Marshal(generationTestSpace("one").VectorIdentity())
	two, _ := json.Marshal(generationTestSpace("two").VectorIdentity())
	for _, row := range []struct {
		ref, project, source, identity string
	}{
		{"good-ref", "good", "one", string(one)},
		{"mixed-ref-one", "mixed", "one", string(one)},
		{"mixed-ref-two", "mixed", "two", string(two)},
		{"corrupt-ref", "corrupt", "one", string(one)},
	} {
		if _, err := store.db.Exec(
			`INSERT INTO knowledge_sources(
				local_ref_id,project_id,source_type,source_id,text,content_hash,identity,added_at,synced_at
			 ) VALUES(?,?,?,?,?,?,?,?,?)`,
			row.ref, row.project, knowledge.SourceTypeDocument, row.source, "", row.source+"-hash",
			row.identity, at, at,
		); err != nil {
			t.Fatal(err)
		}
	}
	validVector := encodeVector([]float64{0.5, 0.5})
	for _, row := range []struct {
		id, ref string
		vector  []byte
	}{
		{"good-window", "good-ref", validVector},
		{"corrupt-window", "corrupt-ref", []byte{1, 2, 3, 4}},
	} {
		if _, err := store.db.Exec(
			`INSERT INTO knowledge_windows(
				id,local_ref_id,ordinal,win_start,win_end,embedding,text,blocks,embedding_v2
			 ) VALUES(?,?,0,0,1,'','text','[]',?)`,
			row.id, row.ref, row.vector,
		); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.migrateKnowledgeGenerations(); err != nil {
		t.Fatal(err)
	}

	token, generation, _, err := store.Active("good", knowledge.LatticeText)
	if err != nil {
		t.Fatal(err)
	}
	if generation.SourceCount != 1 || generation.ArtifactCount != 1 {
		t.Fatalf("migrated counts = sources %d artifacts %d", generation.SourceCount, generation.ArtifactCount)
	}
	if _, ok, err := store.ForGeneration(token.GenerationID).SourceByOrigin(
		"good", knowledge.SourceTypeDocument, "one"); err != nil || !ok {
		t.Fatalf("migrated source = ok %v err %v", ok, err)
	}
	for _, projectID := range []string{"mixed", "corrupt"} {
		if _, _, _, err := store.Active(projectID, knowledge.LatticeText); !errors.Is(err, knowledge.ErrEmbeddingSpaceUnavailable) {
			t.Fatalf("%s active error = %v", projectID, err)
		}
		quarantined, err := store.generation(nil, legacyGenerationID(projectID))
		if err != nil || quarantined.State != knowledge.GenerationReembedRequired {
			t.Fatalf("%s generation = %+v, %v", projectID, quarantined, err)
		}
		if _, _, err := store.EnsureActive(
			projectID, knowledge.LatticeText,
			knowledge.LatticeGeneration{ID: projectID + "-implicit"},
			generationTestSpace("implicit"),
		); !errors.Is(err, knowledge.ErrEmbeddingSpaceChangeRequired) {
			t.Fatalf("%s ordinary initialization error = %v", projectID, err)
		}
	}
	baseToken, base, baseSpace, err := store.ReembedBase("mixed", knowledge.LatticeText)
	if err != nil || base.ID != legacyGenerationID("mixed") || baseToken.GenerationID != base.ID ||
		baseSpace != (knowledge.EmbeddingSpace{}) {
		t.Fatalf("quarantined re-embed base = token %+v generation %+v space %+v err %v",
			baseToken, base, baseSpace, err)
	}
	preview := knowledge.ReembedPreview{
		ID: "mixed-preview", ProjectID: "mixed", Kind: knowledge.LatticeText,
		FromGenerationID: base.ID, ToSpace: generationTestSpace("repair"),
		ExpectedStateRevision: baseToken.StateRevision, SourceCursor: baseToken.SourceCursor,
		CreatedAt: time.Date(2026, 7, 30, 10, 0, 0, 0, time.UTC),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run, _, err := store.StartReembed(
		preview.ID,
		knowledge.ReembedRun{ID: "mixed-run", IdempotencyKey: "mixed-key", CreatedAt: preview.CreatedAt},
		knowledge.LatticeGeneration{ID: "mixed-repaired", CreatedAt: preview.CreatedAt},
	)
	if err != nil || run.FromGenerationID != base.ID {
		t.Fatalf("quarantined start = %+v, %v", run, err)
	}
}

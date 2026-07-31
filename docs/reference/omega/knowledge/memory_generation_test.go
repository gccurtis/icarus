package knowledge_test

import (
	"errors"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func lifecycleSpace(model string) knowledge.EmbeddingSpace {
	return knowledge.SpaceForIdentity(knowledge.VectorIdentity{
		Provider: "test", Model: model, Dims: 2,
	})
}

func lifecycleWrite(projectID, ref, sourceID, text string, revision int64, space knowledge.EmbeddingSpace) knowledge.SourceWrite {
	at := time.Date(2026, 7, 30, 1, 0, 0, 0, time.UTC)
	return knowledge.SourceWrite{
		Source: knowledge.Source{
			LocalRefID: ref, ProjectID: projectID, SourceType: knowledge.SourceTypeDocument,
			SourceID: sourceID, SizeBytes: len(text), LineCount: 1,
			ContentHash: knowledge.ContentHash(text), Identity: space.VectorIdentity(),
			AddedAt: at, SyncedAt: at, Revision: revision,
		},
		Windows: []knowledge.Window{{
			ID: ref + "-window", LocalRefID: ref, Ordinal: 0, Start: 0, End: len(text),
			Text: text, Embedding: []float64{1, 0},
		}},
	}
}

func ensureLifecycleActive(t *testing.T, store *knowledge.MemoryStore, projectID, generationID string, space knowledge.EmbeddingSpace, at time.Time) knowledge.ReadToken {
	t.Helper()
	token, generation, err := store.EnsureActive(projectID, knowledge.LatticeText, knowledge.LatticeGeneration{
		ID: generationID, CreatedAt: at,
	}, space)
	if err != nil {
		t.Fatal(err)
	}
	if generation.State != knowledge.GenerationActive || token.GenerationID != generationID {
		t.Fatalf("active generation = %+v, token = %+v", generation, token)
	}
	return token
}

func TestMemoryGenerationViewsAndSourceCursorAreAtomic(t *testing.T) {
	store := knowledge.NewMemoryStore()
	projectID := "project"
	at := time.Date(2026, 7, 30, 1, 0, 0, 0, time.UTC)
	space := lifecycleSpace("v1")
	token := ensureLifecycleActive(t, store, projectID, "generation-1", space, at)

	first := lifecycleWrite(projectID, "ref-1", "source-1", "first", 1, space)
	_, afterFirst, err := store.AdmitAndReplaceActive(token, 10, []knowledge.SourceWrite{first}, at.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if afterFirst.SourceCursor != 1 {
		t.Fatalf("cursor after add = %d, want 1", afterFirst.SourceCursor)
	}
	// A writer that captured the same pointer revision before the first write is
	// still admitted. The mutex serializes it, recomputes capacity, and allocates
	// the next cursor rather than treating a stale cursor as a pointer conflict.
	second := lifecycleWrite(projectID, "ref-2", "source-2", "second", 1, space)
	_, afterSecond, err := store.AdmitAndReplaceActive(token, 10, []knowledge.SourceWrite{second}, at.Add(2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if afterSecond.SourceCursor != 2 {
		t.Fatalf("cursor after serialized add = %d, want 2", afterSecond.SourceCursor)
	}
	if current, _ := store.Current(afterFirst); current {
		t.Fatal("retrieval token stayed current after a later source write")
	}

	shadow := store.ForGeneration("generation-shadow")
	if err := shadow.ReplaceSources([]knowledge.SourceWrite{
		lifecycleWrite(projectID, "shadow-ref", "shadow-source", "shadow", 1, lifecycleSpace("v2")),
	}); err != nil {
		t.Fatal(err)
	}
	if windows, _ := store.ProjectWindows(projectID); len(windows) != 2 {
		t.Fatalf("active view leaked shadow artifacts: %d windows", len(windows))
	}
	if windows, _ := shadow.ProjectWindows(projectID); len(windows) != 1 {
		t.Fatalf("shadow view = %d windows, want 1", len(windows))
	}

	removed, afterRemove, err := store.DeleteActive(afterSecond, knowledge.SourceTypeDocument, "source-1", at.Add(3*time.Minute))
	if err != nil || !removed {
		t.Fatalf("remove = %v, %v", removed, err)
	}
	changes, err := store.SourceChangesAfter(projectID, knowledge.LatticeText, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 3 || changes[2].Operation != knowledge.SourceRemoved ||
		changes[2].Cursor != afterRemove.SourceCursor || changes[2].ContentHash != first.Source.ContentHash {
		t.Fatalf("durable source changes = %+v", changes)
	}
	changed, err := store.ChangedSince(projectID, knowledge.LatticeText, at.Add(2*time.Minute))
	if err != nil || !changed {
		t.Fatalf("remove tombstone not observed by ChangedSince: %v, %v", changed, err)
	}
}

func TestMemoryReembedPromoteAndRollbackLifecycle(t *testing.T) {
	store := knowledge.NewMemoryStore()
	projectID := "project"
	at := time.Date(2026, 7, 30, 2, 0, 0, 0, time.UTC)
	fromSpace := lifecycleSpace("v1")
	toSpace := lifecycleSpace("v2")
	token := ensureLifecycleActive(t, store, projectID, "generation-1", fromSpace, at)
	activeWrite := lifecycleWrite(projectID, "active-ref", "source-1", "active", 1, fromSpace)
	_, token, err := store.AdmitAndReplaceActive(token, 10, []knowledge.SourceWrite{activeWrite}, at.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}

	preview := knowledge.ReembedPreview{
		ID: "preview-1", ProjectID: projectID, Kind: knowledge.LatticeText,
		FromGenerationID: token.GenerationID, FromSpace: fromSpace, ToSpace: toSpace,
		ExpectedStateRevision: token.StateRevision, SourceCursor: token.SourceCursor,
		Sources: 1, Policy: knowledge.ReembedPolicy{
			MaxSources: 2, MaxBytes: 100, MaxVectors: 10, MaxPromptTokens: 100,
		},
		CreatedBy: "owner", CreatedAt: at.Add(2 * time.Minute), ExpiresAt: at.Add(time.Hour),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run := knowledge.ReembedRun{
		ID: "run-1", IdempotencyKey: "request-1", ActorID: "owner",
		CreatedAt: at.Add(3 * time.Minute),
	}
	generation := knowledge.LatticeGeneration{ID: "generation-2", CreatedAt: run.CreatedAt}
	run, existed, err := store.StartReembed(preview.ID, run, generation)
	if err != nil || existed {
		t.Fatalf("start = %+v, existed=%v, err=%v", run, existed, err)
	}
	duplicate, existed, err := store.StartReembed(preview.ID, knowledge.ReembedRun{
		ID: "other-run", IdempotencyKey: "request-1", CreatedAt: run.CreatedAt,
	}, knowledge.LatticeGeneration{ID: "other-generation"})
	if err != nil || !existed || duplicate.ID != run.ID {
		t.Fatalf("idempotent start = %+v, existed=%v, err=%v", duplicate, existed, err)
	}
	run, claimed, err := store.ClaimReembed(run.ID, at.Add(4*time.Minute))
	if err != nil || !claimed || run.Status != knowledge.ReembedRunning {
		t.Fatalf("claim = %+v, claimed=%v, err=%v", run, claimed, err)
	}

	shadowWrite := lifecycleWrite(projectID, "shadow-ref", "source-1", "active", 1, toSpace)
	checkpoint := knowledge.ReembedCheckpoint{
		SourceType: knowledge.SourceTypeDocument, SourceID: "source-1",
		Revision: 1, ContentHash: shadowWrite.Source.ContentHash, Status: "complete",
		Attempts: 1, BytesRead: int64(shadowWrite.Source.SizeBytes), Vectors: 1,
		Usage: knowledge.Usage{PromptTokens: 2, TotalTokens: 2},
	}
	run, err = store.CommitReembedCheckpoint(run.ID, checkpoint, &shadowWrite, 10, at.Add(5*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if run.SourcesCompleted != 1 || run.Vectors != 1 {
		t.Fatalf("checkpoint totals = %+v", run)
	}
	// Retry of the same completed checkpoint is idempotent: no double accounting.
	run, err = store.CommitReembedCheckpoint(run.ID, checkpoint, &shadowWrite, 10, at.Add(6*time.Minute))
	if err != nil || run.SourcesCompleted != 1 || run.Vectors != 1 {
		t.Fatalf("idempotent checkpoint = %+v, %v", run, err)
	}

	validation := knowledge.Validation{
		Complete: true, SourceCount: 1, WindowCount: 1, NodeCount: 0, ArtifactCount: 1,
		ProbeCount: 1, SpaceIdentity: toSpace.Identity(), SourceWatermark: token.SourceCursor,
		ValidatedAt: at.Add(7 * time.Minute),
	}
	run, err = store.MarkReembedReady(run.ID, token.SourceCursor, validation, nil, nil, validation.ValidatedAt)
	if err != nil || run.Status != knowledge.ReembedReady {
		t.Fatalf("ready = %+v, %v", run, err)
	}
	state, err := store.PromoteReembed(projectID, run.ID, "owner", token.StateRevision, at.Add(24*time.Hour), at.Add(8*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if state.ActiveGenerationID != "generation-2" || state.PreviousGenerationID != "generation-1" || state.Revision != 2 {
		t.Fatalf("promoted state = %+v", state)
	}
	if changed, err := store.ChangedSince(projectID, knowledge.LatticeText, at.Add(7*time.Minute)); err != nil || !changed {
		t.Fatalf("promotion did not invalidate ChangedSince: changed=%v err=%v", changed, err)
	}
	if current, _ := store.Current(token); current {
		t.Fatal("pre-promotion token stayed current")
	}
	if source, found, _ := store.ForGeneration("generation-1").SourceByOrigin(projectID, knowledge.SourceTypeDocument, "source-1"); !found || source.Identity != fromSpace.VectorIdentity() {
		t.Fatalf("retained rollback generation = %+v, found=%v", source, found)
	}
	events, _ := store.GenerationEvents(projectID, 0, 0)
	if len(events) != 1 || events[0].Type != "promoted" {
		t.Fatalf("promotion events = %+v", events)
	}

	state, err = store.RollbackGeneration(projectID, knowledge.LatticeText, "owner", state.Revision, at.Add(9*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if state.ActiveGenerationID != "generation-1" || state.Revision != 3 {
		t.Fatalf("rolled-back state = %+v", state)
	}
	if changed, err := store.ChangedSince(projectID, knowledge.LatticeText, at.Add(8*time.Minute)); err != nil || !changed {
		t.Fatalf("rollback did not invalidate ChangedSince: changed=%v err=%v", changed, err)
	}
	events, _ = store.GenerationEvents(projectID, events[0].Sequence, 0)
	if len(events) != 1 || events[0].Type != "rolled_back" {
		t.Fatalf("rollback events = %+v", events)
	}
}

func TestMemoryReembedControlAndFailedPromotionLeaveActiveUntouched(t *testing.T) {
	store := knowledge.NewMemoryStore()
	at := time.Date(2026, 7, 30, 3, 0, 0, 0, time.UTC)
	space := lifecycleSpace("v1")
	token := ensureLifecycleActive(t, store, "project", "generation-1", space, at)
	preview := knowledge.ReembedPreview{
		ID: "preview", ProjectID: "project", Kind: knowledge.LatticeText,
		FromGenerationID: token.GenerationID, FromSpace: space, ToSpace: lifecycleSpace("v2"),
		ExpectedStateRevision: token.StateRevision, SourceCursor: token.SourceCursor,
		CreatedBy: "owner", CreatedAt: at, ExpiresAt: at.Add(time.Hour),
	}
	if err := store.SaveReembedPreview(preview); err != nil {
		t.Fatal(err)
	}
	run, _, err := store.StartReembed(preview.ID, knowledge.ReembedRun{
		ID: "run", IdempotencyKey: "key", ActorID: "owner", CreatedAt: at,
	}, knowledge.LatticeGeneration{ID: "generation-2", CreatedAt: at})
	if err != nil {
		t.Fatal(err)
	}
	run, err = store.SetReembedControl("project", run.ID, knowledge.ControlPause, at.Add(time.Minute))
	if err != nil || run.Status != knowledge.ReembedPaused {
		t.Fatalf("pause = %+v, %v", run, err)
	}
	run, err = store.SetReembedControl("project", run.ID, knowledge.ControlResume, at.Add(2*time.Minute))
	if err != nil || run.Status != knowledge.ReembedQueued {
		t.Fatalf("resume = %+v, %v", run, err)
	}
	run, claimed, err := store.ClaimReembed(run.ID, at.Add(3*time.Minute))
	if err != nil || !claimed {
		t.Fatalf("claim = %+v, %v, %v", run, claimed, err)
	}
	run, err = store.SetReembedControl("project", run.ID, knowledge.ControlCancel, at.Add(4*time.Minute))
	if err != nil || run.Status != knowledge.ReembedCancelled {
		t.Fatalf("cancel = %+v, %v", run, err)
	}
	if _, err := store.PromoteReembed("project", run.ID, "owner", token.StateRevision, at.Add(time.Hour), at.Add(5*time.Minute)); !errors.Is(err, knowledge.ErrReembedIncomplete) {
		t.Fatalf("cancelled promotion error = %v", err)
	}
	current, _, _, err := store.Active("project", knowledge.LatticeText)
	if err != nil || current.GenerationID != token.GenerationID {
		t.Fatalf("cancel changed active generation: %+v, %v", current, err)
	}
}

func TestMemoryRecoverReembedsRestoresCrashBoundaries(t *testing.T) {
	store := knowledge.NewMemoryStore()
	at := time.Date(2026, 7, 30, 4, 0, 0, 0, time.UTC)
	fromSpace := lifecycleSpace("v1")
	toSpace := lifecycleSpace("v2")
	token := ensureLifecycleActive(t, store, "project", "generation-1", fromSpace, at)

	start := func(id string, createdAt time.Time) knowledge.ReembedRun {
		t.Helper()
		preview := knowledge.ReembedPreview{
			ID: "preview-" + id, ProjectID: "project", Kind: knowledge.LatticeText,
			FromGenerationID: token.GenerationID, FromSpace: fromSpace, ToSpace: toSpace,
			ExpectedStateRevision: token.StateRevision, SourceCursor: token.SourceCursor,
			CreatedBy: "owner", CreatedAt: createdAt, ExpiresAt: at.Add(time.Hour),
		}
		if err := store.SaveReembedPreview(preview); err != nil {
			t.Fatal(err)
		}
		run, existed, err := store.StartReembed(preview.ID, knowledge.ReembedRun{
			ID: id, IdempotencyKey: "key-" + id, ActorID: "owner", CreatedAt: createdAt,
		}, knowledge.LatticeGeneration{ID: "generation-" + id, CreatedAt: createdAt})
		if err != nil || existed {
			t.Fatalf("start %s: existed=%v err=%v", id, existed, err)
		}
		return run
	}

	queued := start("queued", at.Add(time.Minute))
	running := start("running", at.Add(2*time.Minute))
	pausing := start("pausing", at.Add(3*time.Minute))
	if _, claimed, err := store.ClaimReembed(running.ID, at.Add(4*time.Minute)); err != nil || !claimed {
		t.Fatalf("claim running: claimed=%v err=%v", claimed, err)
	}
	if _, claimed, err := store.ClaimReembed(pausing.ID, at.Add(4*time.Minute)); err != nil || !claimed {
		t.Fatalf("claim pausing: claimed=%v err=%v", claimed, err)
	}
	if run, err := store.SetReembedControl("project", pausing.ID, knowledge.ControlPause, at.Add(5*time.Minute)); err != nil || run.Status != knowledge.ReembedPausing {
		t.Fatalf("request pause: %+v, %v", run, err)
	}

	recoveredAt := at.Add(10 * time.Minute)
	recovered, err := store.RecoverReembeds(recoveredAt)
	if err != nil {
		t.Fatal(err)
	}
	if len(recovered) != 2 || recovered[0].ID != queued.ID || recovered[1].ID != running.ID {
		t.Fatalf("recovery scheduling order = %+v", recovered)
	}
	if recovered[0].UpdatedAt.Equal(recoveredAt) {
		t.Fatal("an already queued run was rewritten during recovery")
	}
	if recovered[1].Status != knowledge.ReembedQueued || !recovered[1].UpdatedAt.Equal(recoveredAt) {
		t.Fatalf("interrupted run was not requeued: %+v", recovered[1])
	}
	paused, err := store.ReembedRun("project", pausing.ID)
	if err != nil || paused.Status != knowledge.ReembedPaused || !paused.UpdatedAt.Equal(recoveredAt) {
		t.Fatalf("pausing run did not settle paused: %+v, %v", paused, err)
	}

	// Recovery is idempotent: a second startup sees the same queue and does not
	// perturb its stable ordering or timestamps.
	again, err := store.RecoverReembeds(recoveredAt.Add(time.Minute))
	if err != nil || len(again) != 2 || again[0].ID != queued.ID || again[1].ID != running.ID {
		t.Fatalf("second recovery = %+v, %v", again, err)
	}
	if !again[1].UpdatedAt.Equal(recoveredAt) {
		t.Fatalf("already recovered run timestamp changed: %v", again[1].UpdatedAt)
	}
}

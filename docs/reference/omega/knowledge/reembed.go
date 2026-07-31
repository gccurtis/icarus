package knowledge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

const JobTypeReembed = "knowledge.reembed.run"

const (
	defaultPreviewTTL  = 15 * time.Minute
	defaultRollbackTTL = 7 * 24 * time.Hour
	maxCatchupPasses   = 3
)

type ReembedPreviewRequest struct {
	ProjectID string
	ActorID   string
	ToSpace   EmbeddingSpace
	Policy    ReembedPolicy
}

func (k *Knowledge) PreviewReembed(ctx context.Context, req ReembedPreviewRequest) (ReembedPreview, error) {
	if k.generations == nil || k.reembedAuth == nil {
		return ReembedPreview{}, ErrEmbeddingSpaceUnavailable
	}
	if err := req.ToSpace.Validate(); err != nil {
		return ReembedPreview{}, err
	}
	if err := k.reembedAuth.AuthorizeReembed(ctx, req.ProjectID, req.ActorID, req.ToSpace); err != nil {
		return ReembedPreview{}, err
	}
	token, generation, fromSpace, err := k.generations.ReembedBase(req.ProjectID, LatticeText)
	if err != nil {
		return ReembedPreview{}, err
	}
	sources, err := k.generations.ForGeneration(token.GenerationID).Sources(req.ProjectID)
	if err != nil {
		return ReembedPreview{}, err
	}
	policy := k.resolveReembedPolicy(req.Policy)
	preview := ReembedPreview{
		ID: newID(), ProjectID: req.ProjectID, Kind: LatticeText,
		FromGenerationID: generation.ID, FromSpace: fromSpace, ToSpace: req.ToSpace,
		ExpectedStateRevision: token.StateRevision, SourceCursor: token.SourceCursor,
		Sources: len(sources), Policy: policy, CreatedBy: req.ActorID,
		CreatedAt: k.now().UTC(), ExpiresAt: k.now().UTC().Add(defaultPreviewTTL),
	}
	for _, source := range sources {
		preview.EstimatedBytes += int64(source.SizeBytes)
		// Window count is bounded by bytes/target plus one. It is an advisory
		// preview only; exact Ω-003 artifact admission runs on every checkpoint.
		estimated := source.SizeBytes/max(1, k.windowTarget) + 1
		preview.EstimatedVectors += estimated
		switch source.SourceType {
		case SourceTypeDocument, SourceTypeConnector, SourceTypeAttachment:
		default:
			preview.Unsupported = append(preview.Unsupported, sourceSummary(source))
		}
	}
	preview.EstimatedUsage.PromptTokens = preview.EstimatedBytes / 4
	batch := 96
	if preview.EstimatedVectors > 0 {
		preview.EstimatedUsage.Requests = (preview.EstimatedVectors + batch - 1) / batch
	}
	if policy.MaxSources > 0 && preview.Sources > policy.MaxSources ||
		policy.MaxBytes > 0 && preview.EstimatedBytes > policy.MaxBytes ||
		policy.MaxVectors > 0 && preview.EstimatedVectors > policy.MaxVectors ||
		policy.MaxPromptTokens > 0 && preview.EstimatedUsage.PromptTokens > policy.MaxPromptTokens ||
		policy.MaxRequests > 0 && preview.EstimatedUsage.Requests > policy.MaxRequests {
		return ReembedPreview{}, ErrReembedValidationFailed
	}
	if err := k.generations.SaveReembedPreview(preview); err != nil {
		return ReembedPreview{}, err
	}
	return preview, nil
}

func (k *Knowledge) resolveReembedPolicy(policy ReembedPolicy) ReembedPolicy {
	if policy.MaxSources <= 0 {
		policy.MaxSources = k.maxArtifacts
	}
	if policy.MaxBytes <= 0 {
		policy.MaxBytes = k.maxRunBytes
	}
	if policy.MaxVectors <= 0 {
		policy.MaxVectors = k.maxArtifacts
	}
	return policy
}

func sourceSummary(source Source) SourceSummary {
	return SourceSummary{
		SourceType: source.SourceType, SourceID: source.SourceID, Label: source.Label,
		Revision: source.Revision, ContentHash: source.ContentHash, SizeBytes: source.SizeBytes,
	}
}

func (k *Knowledge) StartReembed(ctx context.Context, projectID, actorID string, command ReembedCommand) (ReembedRun, error) {
	if k.generations == nil || k.reembedAuth == nil || k.enqueuer == nil {
		return ReembedRun{}, ErrEmbeddingSpaceUnavailable
	}
	command.IdempotencyKey = strings.TrimSpace(command.IdempotencyKey)
	if command.IdempotencyKey == "" {
		return ReembedRun{}, errors.New("knowledge: re-embed idempotency key is required")
	}
	preview, err := k.generations.ReembedPreview(projectID, command.PreviewID)
	if err != nil {
		return ReembedRun{}, err
	}
	if err := k.reembedAuth.AuthorizeReembed(ctx, projectID, actorID, preview.ToSpace); err != nil {
		return ReembedRun{}, err
	}
	if preview.CreatedBy != actorID || preview.ExpiresAt.Before(k.now().UTC()) ||
		command.ExpectedStateRevision != preview.ExpectedStateRevision {
		return ReembedRun{}, ErrReembedPreviewStale
	}
	if len(preview.Unsupported) != 0 {
		return ReembedRun{}, ErrReembedIncomplete
	}
	now := k.now().UTC()
	run := ReembedRun{
		ID: newID(), ProjectID: projectID, Kind: LatticeText, PreviewID: preview.ID,
		FromGenerationID:   preview.FromGenerationID,
		TargetGenerationID: newID(), TargetSpace: preview.ToSpace,
		IdempotencyKey: command.IdempotencyKey, Status: ReembedQueued, ActorID: actorID,
		ExpectedRevision: preview.ExpectedStateRevision, StartCursor: preview.SourceCursor,
		CaughtUpCursor: preview.SourceCursor, Policy: preview.Policy, SourcesTotal: preview.Sources,
		CreatedAt: now, UpdatedAt: now,
	}
	generation := LatticeGeneration{
		ID: run.TargetGenerationID, ProjectID: projectID, Kind: LatticeText,
		SpaceIdentity: preview.ToSpace.Identity(), State: GenerationBuilding,
		SourceWatermark: preview.SourceCursor, CreatedBy: actorID, CreatedAt: now,
	}
	stored, existed, err := k.generations.StartReembed(preview.ID, run, generation)
	if err != nil {
		return ReembedRun{}, err
	}
	if existed && stored.Status != ReembedQueued {
		return stored, nil
	}
	if _, err := k.enqueuer.Enqueue(ctx, JobTypeReembed, reembedPayload{RunID: stored.ID}); err != nil {
		// The domain run remains queued and Resume can schedule it again; losing
		// the durable command would be worse than returning the enqueue failure.
		return stored, err
	}
	return stored, nil
}

func (k *Knowledge) ReembedStatus(ctx context.Context, projectID, actorID, runID string) (ReembedRun, error) {
	run, err := k.generations.ReembedRun(projectID, runID)
	if err != nil {
		return ReembedRun{}, err
	}
	if err := k.reembedAuth.AuthorizeReembed(ctx, projectID, actorID, run.TargetSpace); err != nil {
		return ReembedRun{}, err
	}
	return run, nil
}

func (k *Knowledge) ControlReembed(ctx context.Context, projectID, actorID, runID string, control ReembedControl) (ReembedRun, error) {
	run, err := k.ReembedStatus(ctx, projectID, actorID, runID)
	if err != nil {
		return ReembedRun{}, err
	}
	run, err = k.generations.SetReembedControl(projectID, runID, control, k.now().UTC())
	if err != nil {
		return ReembedRun{}, err
	}
	if control == ControlResume {
		if _, err := k.enqueuer.Enqueue(ctx, JobTypeReembed, reembedPayload{RunID: run.ID}); err != nil {
			return run, err
		}
	}
	return run, nil
}

func (k *Knowledge) PromoteReembed(ctx context.Context, projectID, actorID, runID string, expectedRevision int64) (ProjectLatticeState, error) {
	run, err := k.ReembedStatus(ctx, projectID, actorID, runID)
	if err != nil {
		return ProjectLatticeState{}, err
	}
	if run.Status != ReembedReady {
		return ProjectLatticeState{}, ErrReembedIncomplete
	}
	now := k.now().UTC()
	// Authorization is intentionally repeated immediately before the pointer CAS.
	if err := k.reembedAuth.AuthorizeReembed(ctx, projectID, actorID, run.TargetSpace); err != nil {
		return ProjectLatticeState{}, err
	}
	return k.generations.PromoteReembed(projectID, runID, actorID, expectedRevision, now.Add(defaultRollbackTTL), now)
}

func (k *Knowledge) RollbackReembed(ctx context.Context, projectID, actorID string, expectedRevision int64) (ProjectLatticeState, error) {
	token, _, space, err := k.generations.Active(projectID, LatticeText)
	if err != nil {
		return ProjectLatticeState{}, err
	}
	if expectedRevision != token.StateRevision {
		return ProjectLatticeState{}, ErrGenerationConflict
	}
	if err := k.reembedAuth.AuthorizeReembed(ctx, projectID, actorID, space); err != nil {
		return ProjectLatticeState{}, err
	}
	return k.generations.RollbackGeneration(projectID, LatticeText, actorID, expectedRevision, k.now().UTC())
}

type reembedPayload struct {
	RunID string `json:"runId"`
}

func (k *Knowledge) ReembedJob(ctx context.Context, payload json.RawMessage) error {
	var command reembedPayload
	if err := json.Unmarshal(payload, &command); err != nil {
		return err
	}
	return k.runReembed(ctx, command.RunID)
}

func (k *Knowledge) runReembed(ctx context.Context, runID string) error {
	run, claimed, err := k.generations.ClaimReembed(runID, k.now().UTC())
	if errors.Is(err, ErrReembedCancelled) {
		return nil
	}
	if err != nil || !claimed {
		return err
	}
	if err := k.reembedAuth.AuthorizeReembed(ctx, run.ProjectID, run.ActorID, run.TargetSpace); err != nil {
		_ = k.generations.FailReembed(run.ID, "knowledge.reembed_forbidden", "knowledge.reembed_forbidden", k.now().UTC())
		return nil
	}
	if err := run.Policy.check(run); err != nil {
		code := errorCode(err)
		_ = k.generations.FailReembed(run.ID, code, code, k.now().UTC())
		return nil
	}

	checkpoints, err := k.generations.ReembedCheckpoints(run.ID)
	if err != nil {
		return err
	}
	done := make(map[string]ReembedCheckpoint, len(checkpoints))
	for _, checkpoint := range checkpoints {
		done[originKey(checkpoint.SourceType, checkpoint.SourceID)] = checkpoint
	}

	for pass := 0; pass < maxCatchupPasses; pass++ {
		activeToken, _, _, err := k.generations.ReembedBase(run.ProjectID, LatticeText)
		if err != nil {
			return err
		}
		active := k.generations.ForGeneration(activeToken.GenerationID)
		sources, err := active.Sources(run.ProjectID)
		if err != nil {
			return err
		}
		sort.Slice(sources, func(i, j int) bool {
			if sources[i].SourceType != sources[j].SourceType {
				return sources[i].SourceType < sources[j].SourceType
			}
			return sources[i].SourceID < sources[j].SourceID
		})
		live := make(map[string]bool, len(sources))
		for _, source := range sources {
			key := originKey(source.SourceType, source.SourceID)
			live[key] = true
			if checkpoint, ok := done[key]; ok && checkpoint.Status == "complete" &&
				checkpoint.Revision == source.Revision && checkpoint.ContentHash == source.ContentHash {
				continue
			}
			current, err := k.generations.ReembedRun(run.ProjectID, run.ID)
			if err != nil {
				return err
			}
			switch current.Status {
			case ReembedPausing, ReembedPaused:
				_, _ = k.generations.SetReembedControl(run.ProjectID, run.ID, ControlPause, k.now().UTC())
				return nil
			case ReembedCancelling, ReembedCancelled:
				_, _ = k.generations.SetReembedControl(run.ProjectID, run.ID, ControlCancel, k.now().UTC())
				return nil
			}
			item, err := k.reembedSources.ReadReembedSource(ctx, run.ProjectID, run.ActorID, source)
			if err != nil {
				if errors.Is(err, ErrReembedSourceChanged) {
					continue // catch-up pass will re-enumerate
				}
				code := errorCode(err)
				receipt := failedReembedCheckpoint(run.ID, source, code, k.now().UTC())
				if _, commitErr := k.generations.CommitReembedCheckpoint(
					run.ID, receipt, nil, k.maxArtifacts, k.now().UTC(),
				); commitErr != nil && !errors.Is(commitErr, ErrReembedCancelled) {
					return commitErr
				}
				_ = k.generations.FailReembed(run.ID, code, code, k.now().UTC())
				return nil
			}
			write, receipt, err := k.buildReembedSource(ctx, run, item)
			if err != nil {
				code := errorCode(err)
				receipt.Status, receipt.LastError = "failed", code
				if _, commitErr := k.generations.CommitReembedCheckpoint(
					run.ID, receipt, nil, k.maxArtifacts, k.now().UTC(),
				); commitErr != nil && !errors.Is(commitErr, ErrReembedCancelled) {
					return commitErr
				}
				_ = k.generations.FailReembed(run.ID, code, code, k.now().UTC())
				return nil
			}
			updated, err := k.generations.CommitReembedCheckpoint(
				run.ID, receipt, &write, k.maxArtifacts, k.now().UTC(),
			)
			if err != nil {
				if errors.Is(err, ErrReembedCancelled) {
					return nil
				}
				if errors.Is(err, ErrArtifactLimit) {
					code := errorCode(err)
					receipt.Status, receipt.LastError = "failed", code
					if _, commitErr := k.generations.CommitReembedCheckpoint(
						run.ID, receipt, nil, k.maxArtifacts, k.now().UTC(),
					); commitErr != nil {
						return commitErr
					}
					_ = k.generations.FailReembed(run.ID, code, code, k.now().UTC())
					return nil
				}
				return err
			}
			if err := updated.Policy.check(updated); err != nil {
				code := errorCode(err)
				_ = k.generations.FailReembed(run.ID, code, code, k.now().UTC())
				return nil
			}
			done[key] = receipt
		}
		for key, checkpoint := range done {
			if !live[key] {
				if err := k.generations.DeleteReembedCheckpoint(run.ID, checkpoint.SourceType, checkpoint.SourceID, k.now().UTC()); err != nil {
					return err
				}
				delete(done, key)
			}
		}
		latest, _, _, err := k.generations.ReembedBase(run.ProjectID, LatticeText)
		if err != nil {
			return err
		}
		if latest.SourceCursor == activeToken.SourceCursor {
			current, err := k.generations.ReembedRun(run.ProjectID, run.ID)
			if err != nil {
				return err
			}
			if err := current.Policy.check(current); err != nil {
				_ = k.generations.FailReembed(run.ID, errorCode(err), err.Error(), k.now().UTC())
				return nil
			}
			return k.validateShadow(run, latest.SourceCursor, len(sources))
		}
	}
	_ = k.generations.FailReembed(
		run.ID, "knowledge.reembed_source_changed", "knowledge.reembed_source_changed", k.now().UTC(),
	)
	return nil
}

func originKey(sourceType, sourceID string) string { return sourceType + "\x00" + sourceID }

func failedReembedCheckpoint(runID string, source Source, code string, at time.Time) ReembedCheckpoint {
	return ReembedCheckpoint{
		RunID: runID, SourceType: source.SourceType, SourceID: source.SourceID,
		Revision: source.Revision, ContentHash: source.ContentHash, Status: "failed",
		Attempts: 1, LastError: code, UpdatedAt: at,
	}
}

type boundSpaceEmbedder struct {
	inner Embedder
	space EmbeddingSpace
}

func (b boundSpaceEmbedder) Embed(ctx context.Context, texts []string) (Embedded, error) {
	var (
		result Embedded
		err    error
	)
	if exact, ok := b.inner.(IdentityEmbedder); ok {
		result, err = exact.EmbedInSpace(ctx, b.space, texts)
	} else {
		result, err = b.inner.Embed(ctx, texts)
	}
	if err == nil && result.Identity != b.space.VectorIdentity() {
		return result, ErrEmbeddingSpaceUnavailable
	}
	return result, err
}

func (k *Knowledge) buildReembedSource(ctx context.Context, run ReembedRun, item AddItem) (SourceWrite, ReembedCheckpoint, error) {
	view := *k
	view.store = k.generations.ForGeneration(run.TargetGenerationID)
	view.generations = nil
	view.generationID = run.TargetGenerationID
	view.embedder = boundSpaceEmbedder{inner: k.embedder, space: run.TargetSpace}
	now := k.now().UTC()
	checkpoint := ReembedCheckpoint{
		RunID: run.ID, SourceType: item.SourceType, SourceID: item.SourceID,
		Revision: item.Revision, Status: "failed", Attempts: 1, UpdatedAt: now,
	}
	plan, err := view.planAdd(ctx, run.ProjectID, item, Source{}, false, now, 0)
	if err != nil {
		checkpoint.LastError = errorCode(err)
		return SourceWrite{}, checkpoint, err
	}
	checkpoint.ContentHash = plan.source.ContentHash
	checkpoint.BytesRead = int64(plan.source.SizeBytes)
	if err := view.embedPending(ctx, []*addPlan{plan}); err != nil {
		checkpoint.Vectors, checkpoint.Usage = plan.embedded, plan.usage
		checkpoint.LastError = errorCode(err)
		return SourceWrite{}, checkpoint, err
	}
	if len(plan.vecs) > 0 && plan.source.Identity != run.TargetSpace.VectorIdentity() {
		checkpoint.Vectors, checkpoint.Usage = len(plan.windows), plan.usage
		checkpoint.LastError = errorCode(ErrEmbeddingSpaceUnavailable)
		return SourceWrite{}, checkpoint, ErrEmbeddingSpaceUnavailable
	}
	plan.cluster(&view, now)
	checkpoint.Status, checkpoint.LastError = "complete", ""
	checkpoint.Vectors, checkpoint.Usage = len(plan.windows), plan.usage
	return SourceWrite{Source: plan.source, Windows: plan.windows, Nodes: plan.nodes}, checkpoint, nil
}

func (k *Knowledge) validateShadow(run ReembedRun, watermark int64, sourceCount int) error {
	store := k.generations.ForGeneration(run.TargetGenerationID)
	sources, err := store.Sources(run.ProjectID)
	if err != nil {
		return err
	}
	if len(sources) != sourceCount {
		return ErrReembedIncomplete
	}
	var (
		frontier    []FrontierEntry
		windowCount int
		sourceNodes int
		probes      int
	)
	for _, source := range sources {
		if source.Identity != run.TargetSpace.VectorIdentity() || source.ContentHash == "" {
			return ErrReembedValidationFailed
		}
		windows, err := store.SourceWindows(source.LocalRefID)
		if err != nil {
			return err
		}
		windowCount += len(windows)
		if len(windows) > 0 {
			ids := make([]string, len(windows))
			ranked := make([]scoredWindow, len(windows))
			for i, window := range windows {
				if window.LocalRefID != source.LocalRefID {
					return ErrReembedValidationFailed
				}
				ids[i] = window.ID
				ranked[i] = scoredWindow{w: window, score: 1}
			}
			content, err := store.WindowContent(ids)
			if err != nil {
				return err
			}
			token := ReadToken{
				ProjectID: run.ProjectID, Kind: LatticeText, GenerationID: run.TargetGenerationID,
				StateRevision: run.ExpectedRevision, SourceCursor: watermark,
			}
			if _, err := buildRegionsChecked(
				ranked,
				map[string]Source{source.LocalRefID: source}, content, k.charBudget, token, run.TargetSpace,
			); err != nil {
				return ErrReembedValidationFailed
			}
			probes++
		}
	}
	view := *k
	view.store = store
	if err := view.validateArtifactGraph(run.ProjectID, run.TargetSpace.Dimensions); err != nil {
		return ErrReembedValidationFailed
	}
	frontier, err = store.SourceFrontier(run.ProjectID)
	if err != nil {
		return err
	}
	ids := make([]string, len(frontier))
	vecs := make([][]float64, len(frontier))
	for i := range frontier {
		ids[i], vecs[i] = frontier[i].ID, frontier[i].Vector
	}
	ascent := ascend(ascentScope{projectID: run.ProjectID}, ids, vecs, k.cluster, k.now().UTC())
	counts, err := store.ArtifactCounts(run.ProjectID)
	if err != nil {
		return err
	}
	for ref, count := range counts {
		if ref != "" {
			sourceNodes += count
		}
	}
	artifactCount := sourceNodes + len(ascent.nodes)
	if k.maxArtifacts > 0 && artifactCount > k.maxArtifacts {
		return ArtifactLimitExceeded(run.ProjectID, int64(k.maxArtifacts), int64(artifactCount))
	}
	validation := Validation{
		Complete: true, SourceCount: len(sources), WindowCount: windowCount,
		NodeCount: artifactCount - windowCount, ArtifactCount: artifactCount, ProbeCount: probes,
		SpaceIdentity: run.TargetSpace.Identity(), SourceWatermark: watermark, ValidatedAt: k.now().UTC(),
	}
	_, err = k.generations.MarkReembedReady(run.ID, watermark, validation, ascent.nodes, ascent.indexes, k.now().UTC())
	return err
}

func errorCode(err error) string {
	switch {
	case errors.Is(err, ErrReembedCancelled):
		return "knowledge.reembed_cancelled"
	case errors.Is(err, ErrReembedIncomplete):
		return "knowledge.reembed_incomplete"
	case errors.Is(err, ErrReembedValidationFailed):
		return "knowledge.reembed_validation_failed"
	case errors.Is(err, ErrReembedSourceChanged):
		return "knowledge.reembed_source_changed"
	case errors.Is(err, ErrEmbeddingSpaceUnavailable):
		return "knowledge.embedding_space_unavailable"
	case errors.Is(err, ErrSourceBytesLimit):
		return CodeSourceBytesLimit
	case errors.Is(err, ErrRunBytesLimit):
		return CodeRunBytesLimit
	case errors.Is(err, ErrArtifactLimit):
		return CodeArtifactLimit
	default:
		return "knowledge.reembed_failed"
	}
}

func (p ReembedPolicy) check(run ReembedRun) error {
	if p.MaxSources > 0 && run.SourcesCompleted > p.MaxSources ||
		p.MaxBytes > 0 && run.BytesRead > p.MaxBytes ||
		p.MaxVectors > 0 && run.Vectors > p.MaxVectors ||
		p.MaxPromptTokens > 0 && int64(run.Usage.PromptTokens) > p.MaxPromptTokens ||
		p.MaxRequests > 0 && run.Usage.Requests > p.MaxRequests ||
		p.MaxCostUSD > 0 && run.Usage.CostUSD > p.MaxCostUSD {
		return fmt.Errorf("%w: re-embed policy budget exceeded", ErrReembedValidationFailed)
	}
	return nil
}

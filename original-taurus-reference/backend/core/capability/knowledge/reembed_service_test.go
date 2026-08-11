package knowledge_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

type reembedEnqueuer struct {
	payloads []json.RawMessage
}

func (q *reembedEnqueuer) Enqueue(_ context.Context, typ string, payload any) (job.Job, error) {
	if typ != knowledge.JobTypeReembed {
		return job.Job{}, nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return job.Job{}, err
	}
	q.payloads = append(q.payloads, raw)
	return job.Job{}, nil
}

type allowReembed struct{}

func (allowReembed) AuthorizeReembed(context.Context, string, string, knowledge.EmbeddingSpace) error {
	return nil
}

type snapshotReembedReader struct {
	content map[string]string
}

func (r snapshotReembedReader) ReadReembedSource(
	_ context.Context,
	_ string,
	_ string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	text, ok := r.content[source.SourceID]
	if !ok {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	return knowledge.AddItem{
		SourceType: source.SourceType,
		SourceID:   source.SourceID,
		Label:      source.Label,
		Content:    knowledge.TextContent(text),
		Revision:   source.Revision,
	}, nil
}

type failingReembedReader struct{}

func (failingReembedReader) ReadReembedSource(
	context.Context,
	string,
	string,
	knowledge.Source,
) (knowledge.AddItem, error) {
	return knowledge.AddItem{}, errors.Join(
		knowledge.ErrReembedIncomplete,
		errors.New("secret source content must not be retained"),
	)
}

func TestReembedSourceFailurePersistsRedactedReceipt(t *testing.T) {
	ctx := context.Background()
	store := knowledge.NewMemoryStore()
	queue := &reembedEnqueuer{}
	from := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	to := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	opts := smallWindows
	opts.Enqueuer = queue
	k := knowledge.New(store, routingEmbedder{current: from}, opts)
	if _, err := k.Add(
		ctx, "project", knowledge.SourceTypeDocument, "one", "",
		longText("source that will fail migration"), nil, 1,
	); err != nil {
		t.Fatal(err)
	}
	k.UseReembedPorts(allowReembed{}, failingReembedReader{})
	preview, err := k.PreviewReembed(ctx, knowledge.ReembedPreviewRequest{
		ProjectID: "project", ActorID: "owner", ToSpace: knowledge.SpaceForIdentity(to),
		Policy: knowledge.ReembedPolicy{
			MaxSources: 2, MaxBytes: 1 << 20, MaxVectors: 1000,
			MaxPromptTokens: 1000, MaxRequests: 10, MaxCostUSD: 1,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	run, err := k.StartReembed(ctx, "project", "owner", knowledge.ReembedCommand{
		PreviewID: preview.ID, IdempotencyKey: "source-failure",
		ExpectedStateRevision: preview.ExpectedStateRevision,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := k.ReembedJob(ctx, queue.payloads[0]); err != nil {
		t.Fatal(err)
	}
	run, err = k.ReembedStatus(ctx, "project", "owner", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	checkpoints, err := store.ReembedCheckpoints(run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != knowledge.ReembedFailed || run.LastErrorCode != "knowledge.reembed_incomplete" ||
		strings.Contains(run.LastError, "secret") || len(checkpoints) != 1 ||
		checkpoints[0].Status != "failed" ||
		checkpoints[0].LastError != "knowledge.reembed_incomplete" {
		t.Fatalf("failure receipt was absent or unredacted: run=%+v checkpoints=%+v", run, checkpoints)
	}
}

func TestReembedServiceBuildsPromotesAndRollsBackACompleteGeneration(t *testing.T) {
	ctx := context.Background()
	store := knowledge.NewMemoryStore()
	queue := &reembedEnqueuer{}
	from := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	to := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	opts := smallWindows
	opts.Enqueuer = queue
	k := knowledge.New(store, routingEmbedder{current: from}, opts)
	texts := map[string]string{
		"one": longText("one source about orbital mechanics"),
		"two": longText("two source about ocean currents"),
	}
	for id, text := range texts {
		if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, id, id, text, nil, 1); err != nil {
			t.Fatalf("initial add %s: %v", id, err)
		}
	}
	k.UseReembedPorts(allowReembed{}, snapshotReembedReader{content: texts})

	preview, err := k.PreviewReembed(ctx, knowledge.ReembedPreviewRequest{
		ProjectID: "project",
		ActorID:   "owner",
		ToSpace:   knowledge.SpaceForIdentity(to),
		Policy: knowledge.ReembedPolicy{
			MaxSources: 10, MaxBytes: 1 << 20, MaxVectors: 1000,
			MaxPromptTokens: 1000, MaxRequests: 10, MaxCostUSD: 1,
		},
	})
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	run, err := k.StartReembed(ctx, "project", "owner", knowledge.ReembedCommand{
		PreviewID: preview.ID, IdempotencyKey: "request-1",
		ExpectedStateRevision: preview.ExpectedStateRevision,
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	duplicate, err := k.StartReembed(ctx, "project", "owner", knowledge.ReembedCommand{
		PreviewID: preview.ID, IdempotencyKey: "request-1",
		ExpectedStateRevision: preview.ExpectedStateRevision,
	})
	if err != nil || duplicate.ID != run.ID {
		t.Fatalf("idempotent start = %+v, %v", duplicate, err)
	}
	if len(queue.payloads) < 1 {
		t.Fatal("re-embed job was not scheduled")
	}
	if err := k.ReembedJob(ctx, queue.payloads[0]); err != nil {
		t.Fatalf("job: %v", err)
	}
	run, err = k.ReembedStatus(ctx, "project", "owner", run.ID)
	if err != nil || run.Status != knowledge.ReembedReady ||
		!run.Validation.Complete || run.SourcesCompleted != len(texts) {
		t.Fatalf("ready run = %+v, err=%v", run, err)
	}

	state, err := k.PromoteReembed(ctx, "project", "owner", run.ID, preview.ExpectedStateRevision)
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	result, err := k.RetrieveExact(ctx, "project", "orbital", 2)
	if err != nil {
		t.Fatalf("retrieve promoted generation: %v", err)
	}
	if result.GenerationID != state.ActiveGenerationID || result.SpaceIdentity != preview.ToSpace.Identity() ||
		len(result.Regions) == 0 {
		t.Fatalf("promoted retrieval = %+v", result)
	}
	for _, region := range result.Regions {
		if region.GenerationID != state.ActiveGenerationID || region.SourceHash == "" ||
			len(region.WindowIDs) == 0 || region.IndexedRevision != 1 {
			t.Fatalf("incomplete evidence provenance: %+v", region)
		}
	}

	rolledBack, err := k.RollbackReembed(ctx, "project", "owner", state.Revision)
	if err != nil {
		t.Fatalf("rollback: %v", err)
	}
	if rolledBack.ActiveGenerationID != preview.FromGenerationID {
		t.Fatalf("rollback state = %+v, want active %s", rolledBack, preview.FromGenerationID)
	}
}

type pricedRoutingEmbedder struct {
	routingEmbedder
}

func (e pricedRoutingEmbedder) EmbedInSpace(
	ctx context.Context,
	space knowledge.EmbeddingSpace,
	texts []string,
) (knowledge.Embedded, error) {
	out, err := e.routingEmbedder.EmbedInSpace(ctx, space, texts)
	out.Usage = knowledge.Usage{
		PromptTokens: len(texts), TotalTokens: len(texts), Requests: 1, CostUSD: 0.25,
	}
	return out, err
}

func TestReembedHardCostBudgetFailsWithoutChangingActiveGeneration(t *testing.T) {
	ctx := context.Background()
	store := knowledge.NewMemoryStore()
	queue := &reembedEnqueuer{}
	from := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	to := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	opts := smallWindows
	opts.Enqueuer = queue
	k := knowledge.New(store, pricedRoutingEmbedder{routingEmbedder{current: from}}, opts)
	text := longText("budgeted source")
	if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "", text, nil, 1); err != nil {
		t.Fatal(err)
	}
	before, _, _, err := store.Active("project", knowledge.LatticeText)
	if err != nil {
		t.Fatal(err)
	}
	k.UseReembedPorts(allowReembed{}, snapshotReembedReader{content: map[string]string{"one": text}})
	preview, err := k.PreviewReembed(ctx, knowledge.ReembedPreviewRequest{
		ProjectID: "project", ActorID: "owner", ToSpace: knowledge.SpaceForIdentity(to),
		Policy: knowledge.ReembedPolicy{
			MaxSources: 2, MaxBytes: 1 << 20, MaxVectors: 1000,
			MaxPromptTokens: 1000, MaxRequests: 10, MaxCostUSD: 0.01,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	run, err := k.StartReembed(ctx, "project", "owner", knowledge.ReembedCommand{
		PreviewID: preview.ID, IdempotencyKey: "budget",
		ExpectedStateRevision: preview.ExpectedStateRevision,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := k.ReembedJob(ctx, queue.payloads[0]); err != nil {
		t.Fatal(err)
	}
	run, err = k.ReembedStatus(ctx, "project", "owner", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != knowledge.ReembedFailed ||
		run.LastErrorCode != "knowledge.reembed_validation_failed" ||
		run.Usage.CostUSD <= run.Policy.MaxCostUSD {
		t.Fatalf("over-budget run = %+v", run)
	}
	after, _, _, err := store.Active("project", knowledge.LatticeText)
	if err != nil {
		t.Fatal(err)
	}
	if !before.Equal(after) {
		t.Fatalf("failed migration changed active token: before=%+v after=%+v", before, after)
	}
	if _, err := k.PromoteReembed(ctx, "project", "owner", run.ID, before.StateRevision); !errors.Is(err, knowledge.ErrReembedIncomplete) {
		t.Fatalf("failed run promotion error = %v, want ErrReembedIncomplete", err)
	}
}

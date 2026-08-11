package knowledge_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

type reembedChangingReader struct {
	content map[string]string
	change  func()
}

func TestRetrieveFromNeverInitializedProjectIsEmpty(t *testing.T) {
	k := knowledge.New(
		knowledge.NewMemoryStore(),
		routingEmbedder{current: knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}},
		smallWindows,
	)
	result, err := k.RetrieveExact(context.Background(), "empty-project", "anything", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Regions) != 0 {
		t.Fatalf("empty retrieval = %+v", result)
	}
}

func (r *reembedChangingReader) ReadReembedSource(
	_ context.Context,
	_ string,
	_ string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	if r.change != nil {
		change := r.change
		r.change = nil
		change()
	}
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

func TestReembedCatchesUpConcurrentReplacementBeforePromotion(t *testing.T) {
	ctx := context.Background()
	store := knowledge.NewMemoryStore()
	queue := &reembedEnqueuer{}
	from := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	to := knowledge.VectorIdentity{Provider: "fake", Model: "v2", Dims: 64}
	opts := smallWindows
	opts.Enqueuer = queue
	k := knowledge.New(store, routingEmbedder{current: from}, opts)
	original := longText("original source about orbital mechanics")
	replacement := longText("replacement source about marine biology")
	if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "one", original, nil, 1); err != nil {
		t.Fatal(err)
	}
	reader := &reembedChangingReader{content: map[string]string{"one": original}}
	reader.change = func() {
		reader.content["one"] = replacement
		if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "one", replacement, nil, 2); err != nil {
			t.Fatalf("concurrent replacement: %v", err)
		}
	}
	k.UseReembedPorts(allowReembed{}, reader)
	preview, err := k.PreviewReembed(ctx, knowledge.ReembedPreviewRequest{
		ProjectID: "project", ActorID: "owner", ToSpace: knowledge.SpaceForIdentity(to),
		Policy: knowledge.ReembedPolicy{
			MaxSources: 10, MaxBytes: 1 << 20, MaxVectors: 1000,
			MaxPromptTokens: 1000, MaxRequests: 10, MaxCostUSD: 1,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	run, err := k.StartReembed(ctx, "project", "owner", knowledge.ReembedCommand{
		PreviewID: preview.ID, IdempotencyKey: "catch-up",
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
	active, _, _, err := store.Active("project", knowledge.LatticeText)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != knowledge.ReembedReady || run.CaughtUpCursor != active.SourceCursor ||
		run.CaughtUpCursor <= run.StartCursor {
		t.Fatalf("run did not catch up: run=%+v active=%+v", run, active)
	}
	if _, err := k.PromoteReembed(ctx, "project", "owner", run.ID, active.StateRevision); err != nil {
		t.Fatalf("promote caught-up generation: %v", err)
	}
	result, err := k.RetrieveExact(ctx, "project", "marine biology", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Regions) != 1 || !strings.Contains(result.Regions[0].Text, "marine biology") ||
		result.Regions[0].IndexedRevision != 2 {
		t.Fatalf("promoted evidence is not the caught-up revision: %+v", result)
	}
}

type hydrationRaceStore struct {
	*knowledge.MemoryStore
	onHydrate func()
}

func (s *hydrationRaceStore) ForGeneration(generationID string) knowledge.ArtifactStore {
	return hydrationRaceView{
		ArtifactStore: s.MemoryStore.ForGeneration(generationID),
		onHydrate:     s.onHydrate,
	}
}

type hydrationRaceView struct {
	knowledge.ArtifactStore
	onHydrate func()
}

func (v hydrationRaceView) SourcesByRef(refs []string) (map[string]knowledge.Source, error) {
	if v.onHydrate != nil {
		v.onHydrate()
	}
	return v.ArtifactStore.SourcesByRef(refs)
}

func TestRetrieveRetriesReplacementBetweenRankingAndHydration(t *testing.T) {
	ctx := context.Background()
	store := &hydrationRaceStore{MemoryStore: knowledge.NewMemoryStore()}
	identity := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	k := knowledge.New(store, routingEmbedder{current: identity}, smallWindows)
	original := longText("old snapshot about orbital mechanics")
	replacement := longText("new snapshot about marine biology")
	if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "one", original, nil, 1); err != nil {
		t.Fatal(err)
	}
	fired := false
	store.onHydrate = func() {
		if fired {
			return
		}
		fired = true
		if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "one", replacement, nil, 2); err != nil {
			t.Fatalf("replacement during hydration: %v", err)
		}
	}
	result, err := k.RetrieveExact(ctx, "project", "marine biology", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !fired || len(result.Regions) != 1 ||
		!strings.Contains(result.Regions[0].Text, "marine biology") ||
		strings.Contains(result.Regions[0].Text, "orbital mechanics") ||
		result.Regions[0].IndexedRevision != 2 {
		t.Fatalf("retrieval emitted stale or mixed evidence: %+v", result)
	}
}

func TestRetrieveReturnsEvidenceChangedAfterTwoHydrationRaces(t *testing.T) {
	ctx := context.Background()
	store := &hydrationRaceStore{MemoryStore: knowledge.NewMemoryStore()}
	identity := knowledge.VectorIdentity{Provider: "fake", Model: "v1", Dims: 64}
	k := knowledge.New(store, routingEmbedder{current: identity}, smallWindows)
	contents := []string{
		longText("snapshot zero about orbital mechanics"),
		longText("snapshot one about marine biology"),
		longText("snapshot two about forest ecology"),
	}
	if _, err := k.Add(ctx, "project", knowledge.SourceTypeDocument, "one", "one", contents[0], nil, 1); err != nil {
		t.Fatal(err)
	}
	revision := int64(1)
	store.onHydrate = func() {
		revision++
		if _, err := k.Add(
			ctx, "project", knowledge.SourceTypeDocument, "one", "one",
			contents[int(revision-1)], nil, revision,
		); err != nil {
			t.Fatalf("replacement during hydration: %v", err)
		}
	}
	if _, err := k.RetrieveExact(ctx, "project", "ecology", 1); !errors.Is(err, knowledge.ErrEvidenceChanged) {
		t.Fatalf("retrieve error = %v, want ErrEvidenceChanged", err)
	}
	if revision != 3 {
		t.Fatalf("retrieval made %d hydration attempt(s), want 2", revision-1)
	}
}

package document_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// fakeModel returns canned structured outputs and records what it was asked.
type fakeModel struct {
	planJSON  string
	synthJSON string
	lastSynth string // the last synthesize user message (to check prior text is included)
}

type gatedModel struct {
	*fakeModel
	started chan struct{}
	release chan struct{}
}

func (m *gatedModel) Synthesize(ctx context.Context, messages []document.PromptMessage, schema json.RawMessage) (json.RawMessage, document.Usage, error) {
	m.started <- struct{}{}
	<-m.release
	return m.fakeModel.Synthesize(ctx, messages, schema)
}

func (m *fakeModel) Plan(_ context.Context, _ []document.PromptMessage, _ json.RawMessage) (json.RawMessage, document.Usage, error) {
	return json.RawMessage(m.planJSON), document.Usage{PromptTokens: 3, TotalTokens: 3}, nil
}

func (m *fakeModel) Synthesize(_ context.Context, messages []document.PromptMessage, _ json.RawMessage) (json.RawMessage, document.Usage, error) {
	for _, msg := range messages {
		if msg.Role == "user" {
			m.lastSynth = msg.Content
		}
	}
	return json.RawMessage(m.synthJSON), document.Usage{PromptTokens: 7, TotalTokens: 7}, nil
}

// fakeRetriever returns fixed evidence for the queries and records them.
// changed drives the refresh gate.
//
// NOTE: scoped retrieval and persona overlay are model-backed resolution paths,
// so their behavior is proven only by live dev-tests (dev-test/context-scope,
// dev-test/prompt-persona) against a real provider, never with a stubbed model.
// This fake exists only so the pre-existing plumbing tests below compile; it
// satisfies RetrieveScoped by delegating to the same fixed evidence.
type fakeRetriever struct {
	spans    []document.EvidenceSpan
	queries  []string
	changed  bool
	gotAllow []document.ScopeOrigin
}

func (r *fakeRetriever) Retrieve(_ context.Context, _ string, queries []string, _ int) ([]document.EvidenceSpan, document.Usage, error) {
	r.queries = append(r.queries, queries...)
	return r.spans, document.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

func (r *fakeRetriever) RetrieveScoped(_ context.Context, _ string, queries []string, _ int, allow []document.ScopeOrigin) ([]document.EvidenceSpan, document.Usage, error) {
	r.queries = append(r.queries, queries...)
	r.gotAllow = allow
	return r.spans, document.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

func (r *fakeRetriever) ChangedSince(_ context.Context, _ string, _ time.Time) (bool, error) {
	return r.changed, nil
}

func promptDocs(m document.PromptModel, r document.Retriever) *document.Documents {
	return document.New(document.NewMemoryStore(), document.Options{PromptModel: m, Retriever: r})
}

// fakeScope expands a bound "context" origin into two leaf documents. It records
// the include/exclude it was asked to expand, proving ResolveBlock hands it the
// anonymous context definition (not an already-subtracted scope) to expand.
type fakeScope struct {
	gotInclude, gotExclude []document.ScopeOrigin
}

func (f *fakeScope) ExpandScope(_ context.Context, _ string, include, exclude []document.ScopeOrigin) ([]document.ScopeOrigin, error) {
	f.gotInclude, f.gotExclude = include, exclude
	return []document.ScopeOrigin{{Kind: "document", ID: "leaf1"}, {Kind: "document", ID: "leaf2"}}, nil
}

// seedPromptDocWithContextVar creates a document declaring a template variable
// "all" bound to context "C", and a prompt block scoped (include) to that
// variable — the shape a ScopeResolver expands before retrieval.
func seedPromptDocWithContextVar(t *testing.T, d *document.Documents) (projectID, docID, blockID string) {
	t.Helper()
	doc, err := d.Create("p", "Doc", document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: "all", BoundResource: &document.ResourceRef{Kind: "context", ID: "C"}},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt,
			Context: &document.BlockContext{Include: []string{"all"}},
			Data:    document.PromptData{Instruction: "How tall is the tower?"},
		}}}},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return "p", doc.ID, "pb"
}

// TestResolveBlockExpandsBoundContext proves ResolveBlock hands a block's
// include/exclude selection to the configured ScopeResolver and retrieves over
// the EXPANDED leaf origins it returns, not the raw context origin.
func TestResolveBlockExpandsBoundContext(t *testing.T) {
	model := &fakeModel{planJSON: `{"queries":["q"]}`, synthJSON: `{"status":"ok","response":"answer"}`}
	retr := &fakeRetriever{}
	docs := promptDocs(model, retr)
	scope := &fakeScope{}
	docs.UseScopeResolver(scope)

	projectID, docID, blockID := seedPromptDocWithContextVar(t, docs)

	if _, err := docs.ResolveBlock(context.Background(), projectID, docID, blockID, document.ResolveReload); err != nil {
		t.Fatalf("resolve: %v", err)
	}
	// The bound context origin reached ExpandScope as an include...
	if len(scope.gotInclude) != 1 || scope.gotInclude[0] != (document.ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("expand got include %+v", scope.gotInclude)
	}
	// ...and the EXPANDED leaves (not the context origin) were used for retrieval.
	want := []document.ScopeOrigin{{Kind: "document", ID: "leaf1"}, {Kind: "document", ID: "leaf2"}}
	if !reflect.DeepEqual(retr.gotAllow, want) {
		t.Fatalf("RetrieveScoped allow = %+v, want %+v", retr.gotAllow, want)
	}
}

func TestResolveBlockPipeline(t *testing.T) {
	model := &fakeModel{
		planJSON:  `{"queries":["solar power","photovoltaic panels"]}`,
		synthJSON: `{"status":"ok","response":"Solar panels convert sunlight into electricity."}`,
	}
	retr := &fakeRetriever{spans: []document.EvidenceSpan{
		{SourceType: "document", SourceID: "s1", Start: 0, End: 20, Text: "Solar panels convert"},
	}}
	d := promptDocs(model, retr)
	ctx := context.Background()

	base := document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "How do solar panels work?"}},
	}}}}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}

	res, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveReload)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != document.PromptStatusOK || res.Evidence != 1 {
		t.Errorf("result = %+v", res)
	}
	// Usage sums plan(3) + retrieve(1, a single pooled call over all queries) + synth(7).
	if res.Usage.TotalTokens != 3+1+7 {
		t.Errorf("usage = %+v, want total 11", res.Usage)
	}
	// Both planned queries were passed to retrieval in one call.
	if len(retr.queries) != 2 || retr.queries[0] != "solar power" {
		t.Errorf("queries = %v", retr.queries)
	}

	// The generated text and resolution were incorporated into the block.
	got, _ := d.Get("p", doc.ID)
	pb := got.Base.Rows[0].Blocks[0]
	if pb.DisplayText() != "Solar panels convert sunlight into electricity." {
		t.Errorf("generated text = %q", pb.DisplayText())
	}
	if !pb.Inferred {
		t.Errorf("block not inferred")
	}
	pd := pb.Data.(document.PromptData)
	if pd.Status != document.PromptStatusOK || pd.Instruction != "How do solar panels work?" || len(pd.Evidence) != 1 {
		t.Errorf("prompt data = %+v", pd)
	}
	if pd.LastOutput != "Solar panels convert sunlight into electricity." {
		t.Errorf("last output not recorded: %q", pd.LastOutput)
	}
	// The resolution's cost is recorded on the block (it runs in a job, so this
	// is where its usage is surfaced).
	if pd.Usage.TotalTokens != res.Usage.TotalTokens || pd.Usage.TotalTokens == 0 {
		t.Errorf("block usage = %+v, result usage = %+v", pd.Usage, res.Usage)
	}

	// A re-resolve feeds the current text back in as the prior value (stability).
	if _, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveReload); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(model.lastSynth, "Solar panels convert sunlight into electricity.") {
		t.Errorf("prior text not fed to synthesis:\n%s", model.lastSynth)
	}
}

func TestResolveBlockDoesNotOverwriteAChangedRevision(t *testing.T) {
	model := &gatedModel{
		fakeModel: &fakeModel{
			planJSON:  `{"queries":["q"]}`,
			synthJSON: `{"status":"ok","response":"generated"}`,
		},
		started: make(chan struct{}, 1),
		release: make(chan struct{}),
	}
	d := promptDocs(model, &fakeRetriever{})
	doc, err := d.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt,
			Data: document.PromptData{Instruction: "old instruction"},
		}},
	}}})
	if err != nil {
		t.Fatal(err)
	}

	resolved := make(chan error, 1)
	go func() {
		_, err := d.ResolveBlock(context.Background(), "p", doc.ID, "pb", document.ResolveReload)
		resolved <- err
	}()
	<-model.started

	newInstruction := "new instruction"
	if _, err := d.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID: "edit-during-resolution", ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpSetPrompt, BlockID: "pb", SetText: &newInstruction,
		}},
	}); err != nil {
		t.Fatal(err)
	}
	close(model.release)

	err = <-resolved
	var conflict *document.AdmissionConflict
	if !errors.Is(err, document.ErrRevisionConflict) || !errors.As(err, &conflict) ||
		conflict.CurrentRevision != 1 {
		t.Fatalf("stale prompt result err = %#v", err)
	}
	got, err := d.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	block := got.Base.Rows[0].Blocks[0]
	pd := block.Data.(document.PromptData)
	if got.Revision != 1 || pd.Instruction != newInstruction ||
		block.DisplayText() != "" || !pd.ResolvedAt.IsZero() {
		t.Fatalf("stale resolution overwrote authored state: %+v", got)
	}
}

// The retriever already returns one consolidated, non-overlapping set (pooling
// and merging live in the knowledge layer); the resolution carries each span's
// relevance straight onto the stored evidence.
func TestResolveBlockCarriesRelevance(t *testing.T) {
	model := &fakeModel{planJSON: `{"queries":["q"]}`, synthJSON: `{"status":"ok","response":"answer"}`}
	retr := &fakeRetriever{spans: []document.EvidenceSpan{
		{SourceType: "document", SourceID: "s1", Start: 0, End: 5, Text: "alpha", Relevance: 0.73},
	}}
	d := promptDocs(model, retr)

	doc, _ := d.Create("p", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "?"}},
	}}}})
	if _, err := d.ResolveBlock(context.Background(), "p", doc.ID, "pb", document.ResolveReload); err != nil {
		t.Fatal(err)
	}

	got, _ := d.Get("p", doc.ID)
	pd := got.Base.Rows[0].Blocks[0].Data.(document.PromptData)
	if len(pd.Evidence) != 1 || pd.Evidence[0].Relevance != 0.73 {
		t.Errorf("evidence = %+v, want the retriever's relevance (0.73) carried onto the stored span", pd.Evidence)
	}
}

func TestResolveBlockInsufficientIsStable(t *testing.T) {
	model := &fakeModel{
		planJSON:  `{"queries":["q"]}`,
		synthJSON: `{"status":"insufficient","response":"Not enough evidence to answer."}`,
	}
	d := promptDocs(model, &fakeRetriever{})
	ctx := context.Background()
	doc, _ := d.Create("p", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "?"}},
	}}}})

	res, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveReload)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != document.PromptStatusInsufficient {
		t.Errorf("status = %q, want insufficient", res.Status)
	}
	got, _ := d.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].DisplayText() != "Not enough evidence to answer." {
		t.Errorf("insufficient text = %q", got.Base.Rows[0].Blocks[0].DisplayText())
	}
}

func TestResolveBlockGuards(t *testing.T) {
	d := promptDocs(&fakeModel{planJSON: `{"queries":[]}`, synthJSON: `{"status":"ok","response":"x"}`}, &fakeRetriever{})
	ctx := context.Background()
	doc, _ := d.Create("p", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "para", Kind: document.BlockKindText, Atoms: []document.Atom{{Text: "hi"}}},
	}}}})

	// Resolving a non-prompt block conflicts.
	if _, err := d.ResolveBlock(ctx, "p", doc.ID, "para", document.ResolveReload); !errors.Is(err, document.ErrConflict) {
		t.Errorf("resolve paragraph = %v, want ErrConflict", err)
	}
	// Unknown block is not found.
	if _, err := d.ResolveBlock(ctx, "p", doc.ID, "nope", document.ResolveReload); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("resolve missing = %v, want ErrNotFound", err)
	}
	// No ports configured → clear error.
	bare := document.New(document.NewMemoryStore(), document.Options{})
	if _, err := bare.ResolveBlock(ctx, "p", "d", "b", document.ResolveReload); err == nil {
		t.Errorf("resolve without ports should error")
	}
}

// Refresh re-resolves only when something changed; reload always runs; editing
// the instruction (which clears ResolvedAt) forces a refresh to re-resolve.
func TestResolveRefreshGate(t *testing.T) {
	model := &fakeModel{planJSON: `{"queries":["q"]}`, synthJSON: `{"status":"ok","response":"answer"}`}
	retr := &fakeRetriever{spans: []document.EvidenceSpan{{SourceType: "document", SourceID: "s1", Text: "e"}}}
	d := promptDocs(model, retr)
	ctx := context.Background()
	doc, _ := d.Create("p", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "?"}},
	}}}})

	// First resolve (reload) runs the pipeline.
	if _, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveReload); err != nil {
		t.Fatal(err)
	}
	runs := len(retr.queries)

	// Refresh with nothing changed → skipped, no pipeline run.
	retr.changed = false
	res, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveRefresh)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Skipped || len(retr.queries) != runs {
		t.Errorf("refresh should skip when unchanged: skipped=%v runs=%d", res.Skipped, len(retr.queries))
	}

	// Refresh with knowledge changed → re-resolves.
	retr.changed = true
	res, err = d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveRefresh)
	if err != nil {
		t.Fatal(err)
	}
	if res.Skipped || len(retr.queries) != runs+1 {
		t.Errorf("refresh should run when changed: skipped=%v runs=%d", res.Skipped, len(retr.queries))
	}
	runs = len(retr.queries)

	// Editing the instruction clears ResolvedAt, so a refresh re-resolves even
	// when knowledge is unchanged.
	retr.changed = false
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetPrompt, BlockID: "pb", SetText: strp("new instruction")},
	}); err != nil {
		t.Fatal(err)
	}
	res, err = d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveRefresh)
	if err != nil {
		t.Fatal(err)
	}
	if res.Skipped || len(retr.queries) != runs+1 {
		t.Errorf("refresh after prompt edit should run: skipped=%v runs=%d", res.Skipped, len(retr.queries))
	}
}

// Auto mode reloads when the block has no text yet, then refreshes.
func TestResolveAutoMode(t *testing.T) {
	model := &fakeModel{planJSON: `{"queries":["q"]}`, synthJSON: `{"status":"ok","response":"answer"}`}
	retr := &fakeRetriever{spans: []document.EvidenceSpan{{SourceType: "document", SourceID: "s1", Text: "e"}}}
	d := promptDocs(model, retr)
	ctx := context.Background()
	doc, _ := d.Create("p", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "?"}},
	}}}})

	// No text yet → auto acts as reload (runs).
	if res, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveAuto); err != nil || res.Skipped {
		t.Fatalf("auto on empty block should run: %+v %v", res, err)
	}
	// Now has text → auto acts as refresh; unchanged → skipped.
	retr.changed = false
	if res, err := d.ResolveBlock(ctx, "p", doc.ID, "pb", document.ResolveAuto); err != nil || !res.Skipped {
		t.Errorf("auto on resolved+unchanged block should skip: %+v %v", res, err)
	}
}

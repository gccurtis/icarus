package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

var testCast = intelligence.Cast{Strength: "low", Speed: "high", Cost: "low"}

type fakeIntelligence struct {
	planResult      intelligence.Result
	inferResult     intelligence.Result
	reasoningResult intelligence.ToolResponse
	// reasonQueue, when non-empty, scripts successive ReasonJSON results (shifted
	// per call) instead of the fixed planResult — for flows that make more than
	// one plain reasoning call (e.g. the corrective report re-ask).
	reasonQueue []intelligence.Result

	planningRequests  []intelligence.ReasonRequest
	inferenceRequests []intelligence.InferRequest
	toolRequests      []intelligence.ToolRequest
	planningSchemas   []json.RawMessage
	toolSchemas       []json.RawMessage
}

func (f *fakeIntelligence) ReasonJSON(_ context.Context, req intelligence.ReasonRequest, schema json.RawMessage) (intelligence.Result, error) {
	f.planningRequests = append(f.planningRequests, req)
	f.planningSchemas = append(f.planningSchemas, append(json.RawMessage(nil), schema...))
	if len(f.reasonQueue) > 0 {
		result := f.reasonQueue[0]
		f.reasonQueue = f.reasonQueue[1:]
		return result, nil
	}
	return f.planResult, nil
}

func (f *fakeIntelligence) InferJSON(_ context.Context, req intelligence.InferRequest, _ json.RawMessage) (intelligence.Result, error) {
	f.inferenceRequests = append(f.inferenceRequests, req)
	return f.inferResult, nil
}

func (f *fakeIntelligence) ReasonWithToolsJSON(_ context.Context, req intelligence.ToolRequest, schema json.RawMessage) (intelligence.ToolResponse, error) {
	f.toolRequests = append(f.toolRequests, req)
	f.toolSchemas = append(f.toolSchemas, append(json.RawMessage(nil), schema...))
	return f.reasoningResult, nil
}

type retrievalCall struct {
	projectID string
	query     string
	topK      int
}

type fakeKnowledge struct {
	results   map[string]knowledge.RetrieveResult
	calls     []retrievalCall
	toolScope string
}

func (f *fakeKnowledge) Retrieve(_ context.Context, projectID, query string, topK int) (knowledge.RetrieveResult, error) {
	f.calls = append(f.calls, retrievalCall{projectID: projectID, query: query, topK: topK})
	return f.results[query], nil
}

func (f *fakeKnowledge) SearchTool(projectID string) intelligence.ToolBinding {
	f.toolScope = projectID
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name: "knowledge.search", Version: "v1", Description: "search the current Project",
			InputSchema: json.RawMessage(`{"type":"object"}`), OutputSchema: json.RawMessage(`{"type":"object"}`),
		},
		Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
			var input struct {
				Query string `json:"query"`
				TopK  int    `json:"topK"`
			}
			if err := json.Unmarshal(raw, &input); err != nil {
				return nil, err
			}
			result, err := f.Retrieve(ctx, projectID, input.Query, input.TopK)
			if err != nil {
				return nil, err
			}
			regions := make([]struct {
				SourceType string               `json:"sourceType"`
				SourceID   string               `json:"sourceId"`
				Start      int                  `json:"start"`
				End        int                  `json:"end"`
				Relevance  float64              `json:"relevance"`
				Text       string               `json:"text"`
				Blocks     []knowledge.BlockRef `json:"blocks,omitempty"`
			}, len(result.Regions))
			for i, region := range result.Regions {
				regions[i].SourceType = region.SourceType
				regions[i].SourceID = region.SourceID
				regions[i].Start = region.Start
				regions[i].End = region.End
				regions[i].Relevance = region.Relevance
				regions[i].Text = region.Text
				regions[i].Blocks = region.Blocks
			}
			return json.Marshal(struct {
				Regions any    `json:"regions"`
				Mode    string `json:"mode"`
			}{Regions: regions, Mode: result.Mode})
		},
	}
}

// ListTool and ReadTool complete the Knowledge port. These tests drive the
// grounded path through search, so the bindings only need to exist and stay
// scoped; the real behavior is covered in the knowledge package's own tests.
func (f *fakeKnowledge) ListTool(projectID string) intelligence.ToolBinding {
	f.toolScope = projectID
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name: "knowledge.list", Version: "v1", Description: "list the current Project's sources",
			InputSchema: json.RawMessage(`{"type":"object"}`), OutputSchema: json.RawMessage(`{"type":"object"}`),
		},
		Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
			return json.RawMessage(`{"sources":[],"total":0,"truncated":false}`), nil
		},
	}
}

func (f *fakeKnowledge) ReadTool(projectID string) intelligence.ToolBinding {
	f.toolScope = projectID
	return intelligence.ToolBinding{
		Definition: intelligence.ToolDefinition{
			Name: "knowledge.read", Version: "v1", Description: "read one of the current Project's sources",
			InputSchema: json.RawMessage(`{"type":"object"}`), OutputSchema: json.RawMessage(`{"type":"object"}`),
		},
		Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
			return json.RawMessage(`{"regions":[],"startLine":0,"endLine":0,"totalLines":0,"truncated":false}`), nil
		},
	}
}

// assertKnowledgeToolSet checks that a grounded turn was offered the
// Knowledge evidence tool. Resource listing and exact reads are separate,
// caller-aware bindings owned by the Resource capability.
func assertKnowledgeToolSet(t *testing.T, defs []intelligence.ToolDefinition) {
	t.Helper()
	got := map[string]bool{}
	for _, d := range defs {
		got[d.Name] = true
	}
	for _, want := range []string{"knowledge.search"} {
		if !got[want] {
			t.Errorf("tool %q was not offered; got %v", want, got)
		}
	}
	if len(defs) != 1 {
		t.Errorf("tool definitions = %d, want 1: %v", len(defs), got)
	}
}

type fakeResourceTools struct{ scopes []ResourceScope }

func (f *fakeResourceTools) ListTool(scope ResourceScope) intelligence.ToolBinding {
	f.scopes = append(f.scopes, scope)
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "resource.list", Version: "v1", Description: "list resources", InputSchema: json.RawMessage(`{"type":"object"}`), OutputSchema: json.RawMessage(`{"type":"object"}`),
	}, Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		return json.RawMessage(`{"resources":[]}`), nil
	}}
}

func (f *fakeResourceTools) ReadTool(scope ResourceScope) intelligence.ToolBinding {
	f.scopes = append(f.scopes, scope)
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "resource.read", Version: "v1", Description: "read resource", InputSchema: json.RawMessage(`{"type":"object"}`), OutputSchema: json.RawMessage(`{"type":"object"}`),
	}, Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		return json.RawMessage(`{"regions":[]}`), nil
	}}
}

func TestAskBindsResourceToolsToTrustedCallerScope(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"No evidence.","citations":[],"uncertainty":"","insufficientEvidence":true}`)},
	}
	tools := &fakeResourceTools{}
	ask := newTestAsk(t, model, &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}})
	ask.resTools = tools
	if _, err := ask.Run(context.Background(), Scope{ProjectID: "project-a", CallerID: "user-a"}, AskRequest{Prompt: "Read the current plan.", Persona: generalPersonaSelection()}); err != nil {
		t.Fatal(err)
	}
	if len(tools.scopes) != 2 {
		t.Fatalf("resource scopes = %+v", tools.scopes)
	}
	for _, scope := range tools.scopes {
		if scope != (ResourceScope{ProjectID: "project-a", CallerID: "user-a"}) {
			t.Fatalf("resource scope = %+v", scope)
		}
	}
}

func TestResourceReadEvidenceIsCiteableAsDirectOrigin(t *testing.T) {
	evidence := evidenceFromToolResults([]intelligence.ToolResult{{
		Name: "resource.read", OK: true,
		Output: json.RawMessage(`{"regions":[{"sourceType":"document","sourceId":"doc-1","start":2,"end":4,"text":"current text"}]}`),
	}})
	if len(evidence) != 1 || evidence[0].Citation != (Citation{SourceType: "document", SourceID: "doc-1", Start: 2, End: 4}) || evidence[0].Text != "current text" {
		t.Fatalf("resource evidence = %+v", evidence)
	}
}

type scriptedProvider struct {
	reasoningCalls []intelligence.ReasoningRequest
}

func (*scriptedProvider) Name() string { return "scripted" }

func (*scriptedProvider) Inference(context.Context, intelligence.InferenceRequest) (intelligence.InferenceResponse, error) {
	return intelligence.InferenceResponse{}, nil
}

func (p *scriptedProvider) Reasoning(_ context.Context, req intelligence.ReasoningRequest) (intelligence.ReasoningResponse, error) {
	p.reasoningCalls = append(p.reasoningCalls, req)
	switch len(p.reasoningCalls) {
	case 1:
		return intelligence.ReasoningResponse{Content: `{"queries":["initial"]}`}, nil
	case 2:
		return intelligence.ReasoningResponse{ToolCalls: []intelligence.ToolCall{{
			ID: "follow-up", Name: "knowledge.search", Version: "v1", Arguments: json.RawMessage(`{"query":"follow-up","topK":1}`),
		}}}, nil
	default:
		return intelligence.ReasoningResponse{Content: `{"answer":"The follow-up source answers it.","citations":[{"sourceType":"document","sourceId":"follow-up","start":4,"end":18}],"uncertainty":"Grounded in follow-up search.","insufficientEvidence":false}`}, nil
	}
}

func (*scriptedProvider) Embed(context.Context, intelligence.EmbeddingRequest) (intelligence.EmbeddingResponse, error) {
	return intelligence.EmbeddingResponse{}, nil
}

func newTestAsk(t *testing.T, model *fakeIntelligence, store *fakeKnowledge) *Ask {
	t.Helper()
	personas := newTestPersonas(t, persona.Options{})
	ask, err := New(Options{
		Intelligence: model, Knowledge: store, Personas: personas,
		PlanningCast: testCast, DefaultCast: testCast,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return ask
}

func newTestPersonas(t *testing.T, opts persona.Options) *persona.Personas {
	t.Helper()
	personas, err := persona.New(persona.NewMemoryStore(), opts)
	if err != nil {
		t.Fatalf("persona.New: %v", err)
	}
	return personas
}

func generalPersonaSelection() persona.Selection {
	return persona.Selection{ID: persona.GeneralID}
}

func TestAskReasoningPlansRetrievesAndValidatesCitation(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":["orbital mechanics"]}`), Usage: intelligence.Usage{TotalTokens: 3}},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"The orbit is elliptical.","citations":[{"sourceType":"document","sourceId":"doc-1","start":10,"end":30}],"uncertainty":"Grounded in one source.","insufficientEvidence":false}`), Usage: intelligence.Usage{TotalTokens: 5}},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{
		"orbital mechanics": {
			Regions: []knowledge.Region{{SourceType: "document", SourceID: "doc-1", Start: 10, End: 30, Relevance: 0.9, Text: "Orbits are elliptical."}},
			Usage:   knowledge.Usage{PromptTokens: 2, TotalTokens: 2},
		},
	}}

	response, err := newTestAsk(t, model, store).Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{
		Prompt:  "What does the document say about the orbit?",
		Persona: generalPersonaSelection(),
		Context: []ContextItem{{Label: "selection", Content: "The highlighted paragraph concerns planetary motion."}},
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if response.Answer != "The orbit is elliptical." || len(response.Citations) != 1 || len(response.Evidence) != 1 {
		t.Errorf("response = %+v", response)
	}
	if response.Usage.Planning.TotalTokens != 3 || response.Usage.Retrieval.TotalTokens != 2 || response.Usage.Answer.TotalTokens != 5 {
		t.Errorf("usage = %+v", response.Usage)
	}
	if len(store.calls) != 1 || store.calls[0] != (retrievalCall{projectID: "project-a", query: "orbital mechanics", topK: hardTopK}) {
		t.Errorf("retrieve calls = %+v", store.calls)
	}
	if len(model.planningRequests) != 1 || len(model.inferenceRequests) != 0 || len(model.toolRequests) != 1 {
		t.Errorf("requests planning=%d inference=%d tools=%d", len(model.planningRequests), len(model.inferenceRequests), len(model.toolRequests))
	}
	finalMessages := model.toolRequests[0].Messages
	if got := finalMessages[len(finalMessages)-1].Content; got != "What does the document say about the orbit?" {
		t.Errorf("final user prompt = %q", got)
	}
	if !strings.Contains(finalMessages[len(finalMessages)-2].Content, "Orbits are elliptical.") {
		t.Errorf("evidence message = %q", finalMessages[len(finalMessages)-2].Content)
	}
}

func TestAskEmptyPlanFallsBackToOriginalPrompt(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"No source was retrieved.","citations":[],"uncertainty":"No evidence.","insufficientEvidence":true}`)},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}

	_, err := newTestAsk(t, model, store).Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "Find the launch date.", Persona: generalPersonaSelection()})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(store.calls) != 1 || store.calls[0].query != "Find the launch date." {
		t.Errorf("retrieve calls = %+v", store.calls)
	}
}

func TestAskLimitsTightenSharedRunnerRetrieval(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":["first","second"]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"No source was retrieved.","citations":[],"uncertainty":"No evidence.","insufficientEvidence":true}`)},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{"first": {}, "second": {}}}
	_, err := newTestAsk(t, model, store).Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "Find it.", Persona: generalPersonaSelection(), Limits: Limits{MaxQueries: 1, TopK: 1}})
	if err != nil {
		t.Fatal(err)
	}
	if len(store.calls) != 1 || store.calls[0] != (retrievalCall{projectID: "project-a", query: "first", topK: 1}) {
		t.Errorf("retrieve calls = %+v", store.calls)
	}
}

func TestAskUsesConfiguredPersonaPromptAndSchema(t *testing.T) {
	policy := DefaultPolicy()
	policy.Prompts.RetrievalPlan = "Configured retrieval prompt."
	policy.Prompts.Ask = "Configured Ask prompt."
	policy.Schemas.RetrievalPlan = json.RawMessage(`{"type":"object","properties":{"queries":{"type":"array"}},"required":["queries"]}`)
	policy.Schemas.Ask = json.RawMessage(`{"type":"object","properties":{"answer":{"type":"string"}},"required":["answer"]}`)
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"No source was retrieved.","citations":[],"uncertainty":"No evidence.","insufficientEvidence":true}`)},
	}
	personas := newTestPersonas(t, persona.Options{GeneralName: "Configured", GeneralDefinition: persona.Definition{BehavioralGuidance: "Configured persona."}})
	ask, err := New(Options{Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: personas, PlanningCast: testCast, DefaultCast: testCast, Policy: policy})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ask.Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "Find it.", Persona: generalPersonaSelection()}); err != nil {
		t.Fatal(err)
	}
	if got := model.planningRequests[0].Messages[0].Content; got != "Configured persona. Configured retrieval prompt." {
		t.Errorf("planning system message = %q", got)
	}
	if got := model.toolRequests[0].Messages[0].Content; got != "Configured persona. Configured Ask prompt." {
		t.Errorf("final system message = %q", got)
	}
	if string(model.planningSchemas[0]) != string(policy.Schemas.RetrievalPlan) || string(model.toolSchemas[0]) != string(policy.Schemas.Ask) {
		t.Errorf("schemas = planning %s final %s", model.planningSchemas[0], model.toolSchemas[0])
	}
}

func TestAskRejectsNonObjectPolicySchema(t *testing.T) {
	policy := DefaultPolicy()
	policy.Schemas.Action = json.RawMessage(`[]`)
	_, err := New(Options{Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{}, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast, Policy: policy})
	if err == nil {
		t.Fatal("New accepted a non-object policy schema")
	}
}

func TestAskReasoningCanCiteSuccessfulFollowupToolEvidence(t *testing.T) {
	model := &fakeIntelligence{
		planResult: intelligence.Result{JSON: json.RawMessage(`{"queries":["initial"]}`)},
		reasoningResult: intelligence.ToolResponse{
			JSON: json.RawMessage(`{"answer":"The follow-up source answers it.","citations":[{"sourceType":"document","sourceId":"follow-up","start":4,"end":18}],"uncertainty":"Grounded in follow-up search.","insufficientEvidence":false}`),
			ToolResults: []intelligence.ToolResult{{
				Name: "knowledge.search", Version: "v1", OK: true,
				Output: json.RawMessage(`{"regions":[{"sourceType":"document","sourceId":"follow-up","start":4,"end":18,"relevance":0.8,"text":"follow-up evidence"}],"mode":"exact"}`),
			}},
		},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{"initial": {}}}

	response, err := newTestAsk(t, model, store).Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "Answer with more detail.", Persona: generalPersonaSelection()})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(response.Citations) != 1 || response.Citations[0].SourceID != "follow-up" || len(response.Evidence) != 1 {
		t.Errorf("response = %+v", response)
	}
	if len(model.toolRequests) != 1 {
		t.Fatalf("tool requests = %d, want 1", len(model.toolRequests))
	}
	assertKnowledgeToolSet(t, model.toolRequests[0].Tools.Definitions())
	if store.toolScope != "project-a" {
		t.Errorf("tool scope = %q, want project-a", store.toolScope)
	}
}

func TestAskReasoningRunsTheActualKnowledgeToolLoop(t *testing.T) {
	provider := &scriptedProvider{}
	intel, err := intelligence.New(intelligence.Options{
		Providers: map[string]intelligence.Provider{"scripted": provider},
		Routes: map[intelligence.Kind][]intelligence.Route{
			intelligence.KindReasoning: {{Cast: testCast, Provider: "scripted", Model: "reason/model"}},
		},
	})
	if err != nil {
		t.Fatalf("intelligence.New: %v", err)
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{
		"initial":   {},
		"follow-up": {Regions: []knowledge.Region{{SourceType: "document", SourceID: "follow-up", Start: 4, End: 18, Relevance: 0.8, Text: "follow-up evidence"}}, Mode: "exact"},
	}}
	ask, err := New(Options{Intelligence: intel, Knowledge: store, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	response, err := ask.Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "Answer with more detail.", Persona: generalPersonaSelection()})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(response.Citations) != 1 || response.Citations[0].SourceID != "follow-up" {
		t.Errorf("response = %+v", response)
	}
	if len(provider.reasoningCalls) != 3 {
		t.Fatalf("reasoning calls = %d, want planner + tool turn + final turn", len(provider.reasoningCalls))
	}
	assertKnowledgeToolSet(t, provider.reasoningCalls[1].Tools)
	assertKnowledgeToolSet(t, provider.reasoningCalls[2].Tools)
	if len(store.calls) != 2 || store.calls[0].projectID != "project-a" || store.calls[1] != (retrievalCall{projectID: "project-a", query: "follow-up", topK: 1}) {
		t.Errorf("retrieve calls = %+v", store.calls)
	}
}

func TestAskRejectsInventedCitation(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":["fact"]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"Unsupported.","citations":[{"sourceType":"document","sourceId":"other","start":0,"end":1}],"uncertainty":"None.","insufficientEvidence":false}`)},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{
		"fact": {Regions: []knowledge.Region{{SourceType: "document", SourceID: "actual", Start: 0, End: 1, Text: "x"}}},
	}}

	_, err := newTestAsk(t, model, store).Run(context.Background(), Scope{ProjectID: "project-a"}, AskRequest{Prompt: "What is the fact?", Persona: generalPersonaSelection()})
	if !errors.Is(err, ErrUnknownCitation) {
		t.Fatalf("Run error = %v, want ErrUnknownCitation", err)
	}
}

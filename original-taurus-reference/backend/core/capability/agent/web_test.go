package agent

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

type fakeWebRetriever struct {
	calls  int
	query  string
	limit  int
	result []WebResult
}

func (f *fakeWebRetriever) SearchWeb(_ context.Context, query string, limit int) ([]WebResult, error) {
	f.calls++
	f.query, f.limit = query, limit
	return f.result, nil
}

func TestWebSearchToolReturnsSnippets(t *testing.T) {
	web := &fakeWebRetriever{result: []WebResult{{Title: "Tides", URL: "https://a", Snippet: "about tides"}}}
	binding := webSearchTool(web)
	if binding.Definition.Name != webSearchToolName {
		t.Fatalf("tool name = %q", binding.Definition.Name)
	}
	out, err := binding.Handler(context.Background(), json.RawMessage(`{"query":"tides","topK":3}`))
	if err != nil {
		t.Fatalf("handler: %v", err)
	}
	var parsed webSearchOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(parsed.Results) != 1 || parsed.Results[0].Title != "Tides" {
		t.Errorf("results = %+v", parsed.Results)
	}
	if web.calls != 1 || web.query != "tides" || web.limit != 3 {
		t.Errorf("retriever got query=%q limit=%d calls=%d", web.query, web.limit, web.calls)
	}
}

func TestWebSearchToolClampsTopKAndRejectsEmpty(t *testing.T) {
	web := &fakeWebRetriever{}
	binding := webSearchTool(web)
	if _, err := binding.Handler(context.Background(), json.RawMessage(`{"query":"x","topK":99}`)); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if web.limit != webSearchMaxTopK {
		t.Errorf("topK should clamp to %d, got %d", webSearchMaxTopK, web.limit)
	}
	if _, err := binding.Handler(context.Background(), json.RawMessage(`{"query":""}`)); err == nil {
		t.Errorf("empty query should error")
	}
}

func newTestAskWeb(t *testing.T, model *fakeIntelligence, store *fakeKnowledge, web WebRetriever) *Ask {
	t.Helper()
	personas := newTestPersonas(t, persona.Options{})
	ask, err := New(Options{
		Intelligence: model, Knowledge: store, Personas: personas,
		PlanningCast: testCast, DefaultCast: testCast, WebRetriever: web,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return ask
}

// askOffersWeb runs one grounded Ask and reports whether the web.search tool was
// offered to the answer call.
func askOffersWeb(t *testing.T, includeWeb bool, web WebRetriever) bool {
	t.Helper()
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":["q"]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"ok","citations":[],"uncertainty":"","insufficientEvidence":true}`)},
	}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{"q": {}}}
	_, err := newTestAskWeb(t, model, store, web).Run(context.Background(), Scope{ProjectID: "p"}, AskRequest{
		Prompt: "Question?", Persona: generalPersonaSelection(), IncludeWeb: includeWeb,
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(model.toolRequests) != 1 {
		t.Fatalf("want 1 tool request, got %d", len(model.toolRequests))
	}
	for _, def := range model.toolRequests[0].Tools.Definitions() {
		if def.Name == webSearchToolName {
			return true
		}
	}
	return false
}

func TestAskOffersWebToolOnlyWhenRequestedAndConfigured(t *testing.T) {
	web := &fakeWebRetriever{}
	if !askOffersWeb(t, true, web) {
		t.Errorf("web tool should be offered when requested and configured")
	}
	if askOffersWeb(t, false, web) {
		t.Errorf("web tool must not be offered when not requested")
	}
	if askOffersWeb(t, true, nil) {
		t.Errorf("web tool must not be offered when no retriever is configured")
	}
}

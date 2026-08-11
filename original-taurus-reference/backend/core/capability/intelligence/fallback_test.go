package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// scriptedProvider fails or succeeds on demand so the fallback tests can force a
// primary route to error and observe the next candidate taking over.
type scriptedProvider struct {
	name          string
	reasoningErr  error
	reasoningResp ReasoningResponse
	inferenceResp InferenceResponse
	embedErr      error
	embedResp     EmbeddingResponse
	reasoningHits int
	embedHits     int

	lastReasoningEffort string
	lastInferenceEffort string
}

func (p *scriptedProvider) Name() string { return p.name }
func (p *scriptedProvider) Inference(_ context.Context, req InferenceRequest) (InferenceResponse, error) {
	p.lastInferenceEffort = req.Effort
	return p.inferenceResp, nil
}
func (p *scriptedProvider) Reasoning(_ context.Context, req ReasoningRequest) (ReasoningResponse, error) {
	p.reasoningHits++
	p.lastReasoningEffort = req.Effort
	if p.reasoningErr != nil {
		return ReasoningResponse{}, p.reasoningErr
	}
	return p.reasoningResp, nil
}
func (p *scriptedProvider) Embed(context.Context, EmbeddingRequest) (EmbeddingResponse, error) {
	p.embedHits++
	if p.embedErr != nil {
		return EmbeddingResponse{}, p.embedErr
	}
	return p.embedResp, nil
}

func twoRouteIntelligence(t *testing.T, primary, backup *scriptedProvider) *Intelligence {
	t.Helper()
	in, err := New(Options{
		Providers: map[string]Provider{"primary": primary, "backup": backup},
		Routes: map[Kind][]Route{
			KindReasoning: {
				{Cast: lowFastCheap, Provider: "primary", Model: "primary/model"},
				{Cast: lowFastCheap, Provider: "backup", Model: "backup/model"},
			},
			KindEmbedding: {
				{Cast: lowFastCheap, Provider: "primary", Model: "primary/embed"},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return in
}

func TestReasonJSONFallsOverToBackup(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningErr: errors.New("provider returned error")}
	backup := &scriptedProvider{name: "backup", reasoningResp: ReasoningResponse{Content: `{"ok":true}`}}
	in := twoRouteIntelligence(t, primary, backup)

	res, err := in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatalf("expected fallback to succeed, got %v", err)
	}
	if string(res.JSON) != `{"ok":true}` {
		t.Fatalf("expected backup's output, got %s", res.JSON)
	}
	if primary.reasoningHits != 1 || backup.reasoningHits != 1 {
		t.Fatalf("expected primary then backup once each, got primary=%d backup=%d", primary.reasoningHits, backup.reasoningHits)
	}
}

func TestFalloverDoesNotRetryOnCanceledContext(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningErr: context.Canceled}
	backup := &scriptedProvider{name: "backup", reasoningResp: ReasoningResponse{Content: `{"ok":true}`}}
	in := twoRouteIntelligence(t, primary, backup)

	_, err := in.Reason(context.Background(), ReasonRequest{Cast: lowFastCheap})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("a canceled context must not fall over, got %v", err)
	}
	if backup.reasoningHits != 0 {
		t.Fatalf("backup must not be tried after a cancellation, got %d hits", backup.reasoningHits)
	}
}

func TestAllCandidatesFailingReturnsLastError(t *testing.T) {
	boom := errors.New("everything is down")
	primary := &scriptedProvider{name: "primary", reasoningErr: errors.New("primary down")}
	backup := &scriptedProvider{name: "backup", reasoningErr: boom}
	in := twoRouteIntelligence(t, primary, backup)

	_, err := in.Reason(context.Background(), ReasonRequest{Cast: lowFastCheap})
	if !errors.Is(err, boom) {
		t.Fatalf("expected the last candidate's error, got %v", err)
	}
}

// An unusable structured response is a failed call like any other, so it must
// fall over to the next candidate. Before this, a single bad sample from the
// primary killed the request outright — the fallback chain was configured,
// loaded, and then skipped for the one failure it is best placed to absorb.
func TestInvalidStructuredJSONFallsOverToBackup(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningResp: ReasoningResponse{Content: "I cannot help with that."}}
	backup := &scriptedProvider{name: "backup", reasoningResp: ReasoningResponse{Content: `{"ok":true}`}}
	in := twoRouteIntelligence(t, primary, backup)

	res, err := in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatalf("expected fallover to the backup, got %v", err)
	}
	if string(res.JSON) != `{"ok":true}` {
		t.Fatalf("expected the backup's JSON, got %s", res.JSON)
	}
}

// Models routinely wrap structured output in a markdown fence, or surround it
// with a sentence, even when strict mode was requested — whether they do
// depends on the upstream host serving the model, which we do not control. The
// JSON is right there, so extract it rather than discarding a usable answer.
func TestStructuredJSONIsExtractedFromDecoratedContent(t *testing.T) {
	for _, tc := range []struct{ name, content string }{
		{"fenced", "```json\n{\"ok\":true}\n```"},
		{"bare fence", "```\n{\"ok\":true}\n```"},
		{"prose around it", "Here is the result:\n{\"ok\":true}\nLet me know if you need more."},
		{"leading whitespace", "\n\n  {\"ok\":true}  "},
	} {
		t.Run(tc.name, func(t *testing.T) {
			primary := &scriptedProvider{name: "primary", reasoningResp: ReasoningResponse{Content: tc.content}}
			backup := &scriptedProvider{name: "backup"}
			in := twoRouteIntelligence(t, primary, backup)

			res, err := in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`))
			if err != nil {
				t.Fatalf("expected the embedded JSON to be accepted, got %v", err)
			}
			if string(res.JSON) != `{"ok":true}` {
				t.Fatalf("extracted %s, want {\"ok\":true}", res.JSON)
			}
			if backup.reasoningHits != 0 {
				t.Errorf("primary's answer was usable; backup should not have been called")
			}
		})
	}
}

// The tool loop needs the same tolerance. It cannot fall over to another model
// once tools have run — that would repeat their side effects — which makes it
// more important, not less, that a usable answer wrapped in a fence is
// accepted, and that an unusable one says what came back.
func TestToolLoopExtractsDecoratedJSONAndReportsContent(t *testing.T) {
	tools, err := NewToolSet()
	if err != nil {
		t.Fatal(err)
	}
	run := func(content string) (ToolResponse, error) {
		primary := &scriptedProvider{name: "primary", reasoningResp: ReasoningResponse{Content: content}}
		in := twoRouteIntelligence(t, primary, &scriptedProvider{name: "backup"})
		return in.ReasonWithToolsJSON(context.Background(),
			ToolRequest{Cast: lowFastCheap, Tools: tools}, json.RawMessage(`{"type":"object"}`))
	}

	res, err := run("```json\n{\"ok\":true}\n```")
	if err != nil {
		t.Fatalf("fenced tool-loop answer rejected: %v", err)
	}
	if string(res.JSON) != `{"ok":true}` {
		t.Fatalf("extracted %s, want {\"ok\":true}", res.JSON)
	}

	if _, err = run("I can't do that."); err == nil {
		t.Fatal("expected an error for an unusable tool-loop answer")
	} else if !strings.Contains(err.Error(), "I can't do that.") {
		t.Errorf("error should quote what the model returned, got: %v", err)
	}
}

// When every candidate returns something unusable the call fails — but the
// error must carry what actually came back. Diagnosing the first occurrence of
// this cost a live run plus manual probing of the provider precisely because
// the offending content was thrown away.
func TestUnusableStructuredResponseErrorCarriesTheContent(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningResp: ReasoningResponse{Content: "I refuse, sorry."}}
	backup := &scriptedProvider{name: "backup", reasoningResp: ReasoningResponse{Content: "also not json"}}
	in := twoRouteIntelligence(t, primary, backup)

	_, err := in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`))
	if err == nil {
		t.Fatal("expected an error when no candidate returns usable JSON")
	}
	if !strings.Contains(err.Error(), "also not json") {
		t.Errorf("error should quote what the model returned, got: %v", err)
	}
	if !strings.Contains(err.Error(), "backup/model") {
		t.Errorf("error should name the model that produced it, got: %v", err)
	}
}

// A provider must return exactly one vector per input. When it returns fewer,
// callers that pair inputs to vectors by index read off the end — the knowledge
// lattice did exactly that and panicked, turning a provider hiccup into a 500
// with an opaque "Internal Server Error". The mismatch has to be caught here,
// at the boundary where the provider's answer enters, and reported as the
// provider failure it is.
func TestEmbedRejectsAVectorCountThatDoesNotMatchTheInputs(t *testing.T) {
	primary := &scriptedProvider{name: "primary", embedResp: EmbeddingResponse{Vectors: nil}}
	backup := &scriptedProvider{name: "backup"}
	in, err := New(Options{
		Providers: map[string]Provider{"primary": primary, "backup": backup},
		Routes: map[Kind][]Route{
			KindEmbedding: {{Cast: lowFastCheap, Provider: "primary", Model: "primary/embed"}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"a", "b"}})
	if err == nil {
		t.Fatal("expected an error when the provider returns no vectors for two inputs")
	}
	if !strings.Contains(err.Error(), "primary/embed") {
		t.Errorf("error should name the model: %v", err)
	}
	if !strings.Contains(err.Error(), "2") || !strings.Contains(err.Error(), "0") {
		t.Errorf("error should state the counts it saw: %v", err)
	}
}

// A route may pin the reasoning effort the provider should spend (OpenRouter's
// reasoning.effort). It is a per-route knob because it belongs to the
// model choice, not the request: the same cast can be served by a cheap model
// told to think hard, and callers must not have to know which. The route's
// effort must reach the provider on both the reasoning and inference paths.
func TestRouteEffortReachesTheProvider(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningResp: ReasoningResponse{Content: `{"ok":true}`}, inferenceResp: InferenceResponse{Content: `{"ok":true}`}}
	in, err := New(Options{
		Providers: map[string]Provider{"primary": primary},
		Routes: map[Kind][]Route{
			KindReasoning: {{Cast: lowFastCheap, Provider: "primary", Model: "primary/model", Effort: "high"}},
			KindInference: {{Cast: lowFastCheap, Provider: "primary", Model: "primary/model", Effort: "low"}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
	if primary.lastReasoningEffort != "high" {
		t.Errorf("reasoning effort = %q, want high", primary.lastReasoningEffort)
	}
	if _, err := in.InferJSON(context.Background(), InferRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
	if primary.lastInferenceEffort != "low" {
		t.Errorf("inference effort = %q, want low", primary.lastInferenceEffort)
	}
}

// Embedding casts must not have fallbacks at all: vectors from different
// models live in different spaces, and every stored source records the model
// identity it was embedded with. A fall-over that silently embeds a query with
// a different model would match nothing — corrupted retrieval, not resilience.
// The guard rejects the configuration at startup, where a misconfiguration is
// loud, instead of at query time, where it is silent.
func TestDuplicateEmbeddingRoutesAreRejected(t *testing.T) {
	primary := &scriptedProvider{name: "primary"}
	backup := &scriptedProvider{name: "backup"}
	_, err := New(Options{
		Providers: map[string]Provider{"primary": primary, "backup": backup},
		Routes: map[Kind][]Route{
			KindEmbedding: {
				{Cast: lowFastCheap, Provider: "primary", Model: "primary/embed"},
				{Cast: lowFastCheap, Provider: "backup", Model: "backup/embed"},
			},
		},
	})
	if err == nil {
		t.Fatal("expected New to reject a second embedding route for the same cast")
	}
	if !strings.Contains(err.Error(), "embedding") {
		t.Fatalf("error should name the embedding kind: %v", err)
	}
}

func TestToolLoopFirstRoundFallsOver(t *testing.T) {
	primary := &scriptedProvider{name: "primary", reasoningErr: errors.New("provider returned error")}
	backup := &scriptedProvider{name: "backup", reasoningResp: ReasoningResponse{Content: `{"done":true}`}}
	in := twoRouteIntelligence(t, primary, backup)

	tools, err := NewToolSet()
	if err != nil {
		t.Fatal(err)
	}
	res, err := in.ReasonWithToolsJSON(context.Background(),
		ToolRequest{Cast: lowFastCheap, Tools: tools}, json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatalf("tool loop should fall over on the first round, got %v", err)
	}
	if string(res.JSON) != `{"done":true}` {
		t.Fatalf("expected backup's output, got %s", res.JSON)
	}
	if backup.reasoningHits != 1 {
		t.Fatalf("expected backup to answer once, got %d", backup.reasoningHits)
	}
}

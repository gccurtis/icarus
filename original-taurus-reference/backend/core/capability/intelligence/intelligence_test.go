package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

// fakeProvider records its requests and returns canned responses, so these tests
// prove cast routing and the deterministic tool loop without a real provider.
type fakeProvider struct {
	name string

	lastInference InferenceRequest
	lastReasoning ReasoningRequest
	lastEmbed     EmbeddingRequest

	inference          InferenceResponse
	reasoning          ReasoningResponse
	reasoningResponses []ReasoningResponse
	reasoningCalls     []ReasoningRequest
	embed              EmbeddingResponse
}

func (f *fakeProvider) Name() string { return f.name }

func (f *fakeProvider) Inference(_ context.Context, req InferenceRequest) (InferenceResponse, error) {
	f.lastInference = req
	return f.inference, nil
}

func (f *fakeProvider) Reasoning(_ context.Context, req ReasoningRequest) (ReasoningResponse, error) {
	f.lastReasoning = req
	f.reasoningCalls = append(f.reasoningCalls, req)
	if len(f.reasoningResponses) == 0 {
		return f.reasoning, nil
	}
	response := f.reasoningResponses[0]
	f.reasoningResponses = f.reasoningResponses[1:]
	return response, nil
}

func (f *fakeProvider) Embed(_ context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	f.lastEmbed = req
	return f.embed, nil
}

// lowFastCheap is the cast used across the tests.
var lowFastCheap = Cast{Purpose: "general", Strength: "low", Speed: "high", Cost: "low"}

func newTestIntelligence(t *testing.T, prov *fakeProvider) *Intelligence {
	t.Helper()
	in, err := New(Options{
		Providers: map[string]Provider{"fake": prov},
		Routes: map[Kind][]Route{
			KindReasoning: {{Cast: lowFastCheap, Provider: "fake", Model: "reason/model"}},
			KindInference: {{Cast: lowFastCheap, Provider: "fake", Model: "infer/model"}},
			KindEmbedding: {{Cast: lowFastCheap, Provider: "fake", Model: "embed/model"}},
		},
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return in
}

func TestReasonResolvesToReasoningModel(t *testing.T) {
	prov := &fakeProvider{name: "fake", reasoning: ReasoningResponse{Content: "hi"}}
	in := newTestIntelligence(t, prov)

	res, err := in.Reason(context.Background(), ReasonRequest{Cast: lowFastCheap, Messages: []Message{{Role: "user", Content: "yo"}}})
	if err != nil {
		t.Fatalf("Reason: %v", err)
	}
	if res.Text != "hi" {
		t.Errorf("text = %q, want hi", res.Text)
	}
	if prov.lastReasoning.Model != "reason/model" {
		t.Errorf("model = %q, want reason/model", prov.lastReasoning.Model)
	}
	if len(prov.lastReasoning.Schema) != 0 || len(prov.lastReasoning.Tools) != 0 {
		t.Error("plain Reason should not carry a schema or tools")
	}
}

func TestInferResolvesToInferenceModel(t *testing.T) {
	prov := &fakeProvider{name: "fake", inference: InferenceResponse{Content: "hi"}}
	in := newTestIntelligence(t, prov)

	if _, err := in.Infer(context.Background(), InferRequest{Cast: lowFastCheap, Messages: []Message{{Role: "user", Content: "yo"}}}); err != nil {
		t.Fatalf("Infer: %v", err)
	}
	if prov.lastInference.Model != "infer/model" {
		t.Errorf("model = %q, want infer/model (reasoning and inference use separate tables)", prov.lastInference.Model)
	}
}

func TestStructuredForwardsSchemaAndReturnsJSON(t *testing.T) {
	prov := &fakeProvider{
		name:      "fake",
		inference: InferenceResponse{Content: `{"ok":true}`},
		reasoning: ReasoningResponse{Content: `{"ok":true}`},
	}
	in := newTestIntelligence(t, prov)
	schema := json.RawMessage(`{"type":"object"}`)

	for _, tc := range []struct {
		name string
		call func() (Result, error)
	}{
		{"ReasonJSON", func() (Result, error) {
			return in.ReasonJSON(context.Background(), ReasonRequest{Cast: lowFastCheap, Messages: []Message{{Role: "user", Content: "x"}}}, schema)
		}},
		{"InferJSON", func() (Result, error) {
			return in.InferJSON(context.Background(), InferRequest{Cast: lowFastCheap, Messages: []Message{{Role: "user", Content: "x"}}}, schema)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			res, err := tc.call()
			if err != nil {
				t.Fatalf("%s: %v", tc.name, err)
			}
			if tc.name == "ReasonJSON" && len(prov.lastReasoning.Schema) == 0 {
				t.Error("schema was not forwarded to Reasoning")
			}
			if tc.name == "InferJSON" && len(prov.lastInference.Schema) == 0 {
				t.Error("schema was not forwarded to Inference")
			}
			if string(res.JSON) != `{"ok":true}` {
				t.Errorf("json = %q, want {\"ok\":true}", res.JSON)
			}
			if res.Text != "" {
				t.Errorf("structured result should not set Text, got %q", res.Text)
			}
		})
	}
}

func TestStructuredRejectsInvalidJSON(t *testing.T) {
	prov := &fakeProvider{name: "fake", inference: InferenceResponse{Content: "not json"}}
	in := newTestIntelligence(t, prov)

	_, err := in.InferJSON(context.Background(), InferRequest{Cast: lowFastCheap, Messages: []Message{{Role: "user", Content: "x"}}}, json.RawMessage(`{"type":"object"}`))
	if err == nil {
		t.Fatal("expected an error when the provider returns invalid JSON for a structured call")
	}
}

func TestReasonWithToolsContinuesAfterPredefinedCall(t *testing.T) {
	called := false
	tools, err := NewToolSet(ToolBinding{
		Definition: testToolDefinition(),
		Handler: func(_ context.Context, arguments json.RawMessage) (json.RawMessage, error) {
			called = true
			if string(arguments) != `{"query":"orbit"}` {
				t.Errorf("arguments = %s", arguments)
			}
			return json.RawMessage(`{"matches":["orbit"]}`), nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	prov := &fakeProvider{name: "fake", reasoningResponses: []ReasoningResponse{
		{ToolCalls: []ToolCall{{ID: "call-1", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{"query":"orbit"}`)}}, Usage: Usage{TotalTokens: 2}},
		{Content: "Found orbit.", Usage: Usage{TotalTokens: 3}},
	}}
	in := newTestIntelligence(t, prov)

	response, err := in.ReasonWithTools(context.Background(), ToolRequest{
		Cast:     lowFastCheap,
		Messages: []Message{{Role: "user", Content: "find orbit"}},
		Tools:    tools,
	})
	if err != nil {
		t.Fatalf("ReasonWithTools: %v", err)
	}
	if !called || response.Text != "Found orbit." || response.Rounds != 1 || response.Calls != 1 {
		t.Errorf("response = %+v, called = %t", response, called)
	}
	if response.Usage.TotalTokens != 5 {
		t.Errorf("usage = %+v, want 5 total tokens", response.Usage)
	}
	if len(response.ToolResults) != 1 || !response.ToolResults[0].OK {
		t.Errorf("tool results = %+v", response.ToolResults)
	}
	if len(prov.reasoningCalls) != 2 {
		t.Fatalf("reasoning calls = %d, want 2", len(prov.reasoningCalls))
	}
	if len(prov.reasoningCalls[0].Tools) != 1 || len(prov.reasoningCalls[1].Tools) != 1 {
		t.Error("the fixed descriptor was not supplied on both reasoning calls")
	}
	if got := prov.reasoningCalls[1].Messages; len(got) != 3 || got[1].Role != "assistant" || got[2].Role != "tool" || got[2].ToolCallID != "call-1" {
		t.Errorf("continued messages = %+v", got)
	}
}

func TestToolSetRejectsMissingRequiredTool(t *testing.T) {
	tools, err := NewToolSet(ToolBinding{
		Definition: testToolDefinition(),
		Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
			return json.RawMessage(`{}`), nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	definition := testToolDefinition()
	if err := tools.ValidateRequired(ToolRef{Name: definition.Name, Version: definition.Version}); err != nil {
		t.Fatalf("registered required tool rejected: %v", err)
	}
	if err := tools.ValidateRequired(ToolRef{Name: "missing", Version: "v1"}); err == nil {
		t.Fatal("missing required tool was accepted")
	}
}

func TestReasonWithToolsJSONContinuesWithOneSchema(t *testing.T) {
	tools, err := NewToolSet(ToolBinding{Definition: testToolDefinition(), Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		return json.RawMessage(`{"matches":["orbit"]}`), nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	schema := json.RawMessage(`{"type":"object","required":["answer"]}`)
	prov := &fakeProvider{name: "fake", reasoningResponses: []ReasoningResponse{
		{ToolCalls: []ToolCall{{ID: "call-1", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{"query":"orbit"}`)}}, Usage: Usage{TotalTokens: 2}},
		{Content: `{"answer":"Found orbit."}`, Usage: Usage{TotalTokens: 3}},
	}}

	response, err := newTestIntelligence(t, prov).ReasonWithToolsJSON(context.Background(), ToolRequest{
		Cast: lowFastCheap, Tools: tools,
	}, schema)
	if err != nil {
		t.Fatalf("ReasonWithToolsJSON: %v", err)
	}
	if string(response.JSON) != `{"answer":"Found orbit."}` || response.Text != "" {
		t.Errorf("response = %+v", response)
	}
	if len(prov.reasoningCalls) != 2 {
		t.Fatalf("reasoning calls = %d, want 2", len(prov.reasoningCalls))
	}
	for i, call := range prov.reasoningCalls {
		if string(call.Schema) != string(schema) {
			t.Errorf("call %d schema = %s, want %s", i, call.Schema, schema)
		}
	}
}

func TestReasonWithToolsJSONRejectsInvalidFinalJSON(t *testing.T) {
	prov := &fakeProvider{name: "fake", reasoning: ReasoningResponse{Content: "not json"}}

	_, err := newTestIntelligence(t, prov).ReasonWithToolsJSON(context.Background(), ToolRequest{Cast: lowFastCheap}, json.RawMessage(`{"type":"object"}`))
	if err == nil {
		t.Fatal("expected invalid structured tool result to fail")
	}
}

func TestReasonWithToolsRejectsUnknownToolWithoutExecuting(t *testing.T) {
	called := false
	tools, err := NewToolSet(ToolBinding{Definition: testToolDefinition(), Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		called = true
		return json.RawMessage(`{}`), nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	prov := &fakeProvider{name: "fake", reasoningResponses: []ReasoningResponse{
		{ToolCalls: []ToolCall{{ID: "call-1", Name: "test.search", Version: "v2", Arguments: json.RawMessage(`{}`)}}, Usage: Usage{TotalTokens: 1}},
		{Content: "That tool is unavailable.", Usage: Usage{TotalTokens: 1}},
	}}

	response, err := newTestIntelligence(t, prov).ReasonWithTools(context.Background(), ToolRequest{Cast: lowFastCheap, Tools: tools})
	if err != nil {
		t.Fatal(err)
	}
	if called {
		t.Fatal("an unknown tool reached a handler")
	}
	if len(response.ToolResults) != 1 || response.ToolResults[0].Error == nil || response.ToolResults[0].Error.Code != "unknown_tool" {
		t.Errorf("tool results = %+v", response.ToolResults)
	}
}

func TestToolSetBoundsArgumentsAndResults(t *testing.T) {
	called := 0
	tools, err := NewToolSet(ToolBinding{Definition: testToolDefinition(), Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		called++
		return json.RawMessage(`{"result":"too large"}`), nil
	}})
	if err != nil {
		t.Fatal(err)
	}

	tooLargeArguments, err := tools.Execute(context.Background(), ToolCall{
		ID: "call-1", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{"query":"long"}`),
	}, ToolLimits{MaxArgumentBytes: 2})
	if err != nil {
		t.Fatal(err)
	}
	if tooLargeArguments.Error == nil || tooLargeArguments.Error.Code != "arguments_too_large" || called != 0 {
		t.Errorf("argument result = %+v, handler calls = %d", tooLargeArguments, called)
	}

	tooLargeResult, err := tools.Execute(context.Background(), ToolCall{
		ID: "call-2", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{}`),
	}, ToolLimits{MaxResultBytes: 2})
	if err != nil {
		t.Fatal(err)
	}
	if tooLargeResult.Error == nil || tooLargeResult.Error.Code != "result_too_large" || called != 1 {
		t.Errorf("result = %+v, handler calls = %d", tooLargeResult, called)
	}
}

func TestReasonWithToolsStopsAtRoundLimit(t *testing.T) {
	called := 0
	tools, err := NewToolSet(ToolBinding{Definition: testToolDefinition(), Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		called++
		return json.RawMessage(`{}`), nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	call := ToolCall{ID: "call", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{}`)}
	prov := &fakeProvider{name: "fake", reasoningResponses: []ReasoningResponse{
		{ToolCalls: []ToolCall{call}},
		{ToolCalls: []ToolCall{call}},
	}}

	_, err = newTestIntelligence(t, prov).ReasonWithTools(context.Background(), ToolRequest{
		Cast: lowFastCheap, Tools: tools, Limits: ToolLimits{MaxRounds: 1},
	})
	if !errors.Is(err, ErrToolLimitExceeded) {
		t.Fatalf("err = %v, want tool limit error", err)
	}
	if called != 1 || len(prov.reasoningCalls) != 2 {
		t.Errorf("called = %d, reasoning calls = %d; want one handler and two provider calls", called, len(prov.reasoningCalls))
	}
}

func TestReasonWithToolsHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	tools, err := NewToolSet(ToolBinding{Definition: testToolDefinition(), Handler: func(context.Context, json.RawMessage) (json.RawMessage, error) {
		cancel()
		return json.RawMessage(`{}`), nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	prov := &fakeProvider{name: "fake", reasoningResponses: []ReasoningResponse{{
		ToolCalls: []ToolCall{{ID: "call", Name: "test.search", Version: "v1", Arguments: json.RawMessage(`{}`)}},
	}}}

	_, err = newTestIntelligence(t, prov).ReasonWithTools(ctx, ToolRequest{Cast: lowFastCheap, Tools: tools})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if len(prov.reasoningCalls) != 1 {
		t.Errorf("reasoning calls = %d, want one", len(prov.reasoningCalls))
	}
}

func TestEmbedResolvesAndReturnsVectors(t *testing.T) {
	prov := &fakeProvider{name: "fake", embed: EmbeddingResponse{Vectors: [][]float64{{1, 2}}}}
	in := newTestIntelligence(t, prov)

	res, err := in.Embed(context.Background(), EmbedRequest{Cast: lowFastCheap, Inputs: []string{"a"}})
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if prov.lastEmbed.Model != "embed/model" {
		t.Errorf("model = %q, want embed/model", prov.lastEmbed.Model)
	}
	if len(res.Vectors) != 1 || res.Vectors[0][1] != 2 {
		t.Errorf("vectors = %v, want [[1 2]]", res.Vectors)
	}
	if res.Usage.Requests != 1 {
		t.Errorf("requests = %d, want 1", res.Usage.Requests)
	}
}

func TestEmbedExactPinsConfiguredProviderAndModel(t *testing.T) {
	prov := &fakeProvider{
		name: "fake",
		embed: EmbeddingResponse{
			Vectors: [][]float64{{1, 0}},
			Usage:   Usage{PromptTokens: 3, TotalTokens: 3, CostUSD: 0.0002},
		},
	}
	in := newTestIntelligence(t, prov)

	res, err := in.EmbedExact(context.Background(), "fake", "retired/embed-model", []string{"a"})
	if err != nil {
		t.Fatalf("EmbedExact: %v", err)
	}
	if prov.lastEmbed.Model != "retired/embed-model" ||
		res.Provider != "fake" || res.Model != "retired/embed-model" {
		t.Fatalf("route = %s/%s, provider request model = %q", res.Provider, res.Model, prov.lastEmbed.Model)
	}
	if res.Usage.Requests != 1 || res.Usage.CostUSD != 0.0002 {
		t.Fatalf("usage = %+v, want one request and provider-reported cost", res.Usage)
	}
	if _, err := in.EmbedExact(context.Background(), "missing", "model", []string{"a"}); !errors.Is(err, ErrProviderNotConfigured) {
		t.Fatalf("missing provider error = %v, want ErrProviderNotConfigured", err)
	}
}

func TestUnconfiguredCastReturnsErrNoCast(t *testing.T) {
	prov := &fakeProvider{name: "fake"}
	in := newTestIntelligence(t, prov)

	missing := Cast{Purpose: "general", Strength: "high", Speed: "high", Cost: "low"}
	_, err := in.Reason(context.Background(), ReasonRequest{Cast: missing})
	if !errors.Is(err, ErrNoCast) {
		t.Errorf("err = %v, want ErrNoCast", err)
	}
}

func TestOmittedPurposeDefaultsToGeneral(t *testing.T) {
	prov := &fakeProvider{name: "fake", reasoning: ReasoningResponse{Content: "ok"}}
	in := newTestIntelligence(t, prov)

	cast := Cast{Strength: "low", Speed: "high", Cost: "low"}
	if _, err := in.Reason(context.Background(), ReasonRequest{Cast: cast}); err != nil {
		t.Errorf("blank purpose should default to general and resolve: %v", err)
	}
}

func TestNewRejectsUnknownProvider(t *testing.T) {
	_, err := New(Options{
		Providers: map[string]Provider{"fake": &fakeProvider{name: "fake"}},
		Routes: map[Kind][]Route{
			KindReasoning: {{Cast: lowFastCheap, Provider: "ghost", Model: "m"}},
		},
	})
	if err == nil {
		t.Fatal("expected New to reject a route naming an unconfigured provider")
	}
}

func TestNewRejectsIncompleteProviderRegistry(t *testing.T) {
	if _, err := New(Options{Providers: map[string]Provider{"missing": nil}}); err == nil {
		t.Fatal("nil provider was accepted")
	}
	provider := &fakeProvider{name: "actual"}
	if _, err := New(Options{Providers: map[string]Provider{"one": provider, "two": provider}}); err == nil {
		t.Fatal("duplicate provider identity was accepted")
	}
}

func testToolDefinition() ToolDefinition {
	return ToolDefinition{
		Name:         "test.search",
		Version:      "v1",
		Description:  "Search test data.",
		InputSchema:  json.RawMessage(`{"type":"object"}`),
		OutputSchema: json.RawMessage(`{"type":"object"}`),
	}
}

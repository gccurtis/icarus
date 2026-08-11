package openrouter

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

// stubOpenRouter starts a fake OpenRouter server that records the last request
// it received and replies with respBody for any path. The returned provider is
// pointed at it.
func stubOpenRouter(t *testing.T, respBody string) (intelligence.Provider, *recorded) {
	t.Helper()
	rec := &recorded{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.path = r.URL.Path
		rec.auth = r.Header.Get("Authorization")
		body, _ := io.ReadAll(r.Body)
		rec.body = body
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, respBody)
	}))
	t.Cleanup(srv.Close)
	return New("test-key", srv.URL, 0), rec
}

type recorded struct {
	path string
	auth string
	body []byte
}

func (r *recorded) decode(t *testing.T) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(r.body, &m); err != nil {
		t.Fatalf("decode request body: %v", err)
	}
	return m
}

func TestOpenRouterInference(t *testing.T) {
	prov, rec := stubOpenRouter(t, `{
		"choices": [{"message": {"content": "pong"}}],
		"usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4}
	}`)

	resp, err := prov.Inference(context.Background(), intelligence.InferenceRequest{
		Model:    "some/model",
		Messages: []intelligence.Message{{Role: "user", Content: "ping"}},
	})
	if err != nil {
		t.Fatalf("Inference: %v", err)
	}
	if resp.Content != "pong" {
		t.Errorf("content = %q, want pong", resp.Content)
	}
	if resp.Usage.TotalTokens != 4 {
		t.Errorf("total tokens = %d, want 4", resp.Usage.TotalTokens)
	}

	if rec.path != "/chat/completions" {
		t.Errorf("path = %q, want /chat/completions", rec.path)
	}
	if rec.auth != "Bearer test-key" {
		t.Errorf("auth = %q, want Bearer test-key", rec.auth)
	}
	sent := rec.decode(t)
	if sent["model"] != "some/model" {
		t.Errorf("model = %v, want some/model", sent["model"])
	}
	if _, ok := sent["response_format"]; ok {
		t.Error("response_format sent for a plain inference request")
	}
	if _, ok := sent["tools"]; ok {
		t.Error("tools sent for message-only inference")
	}
}

func TestOpenRouterInferenceStructured(t *testing.T) {
	prov, rec := stubOpenRouter(t, `{"choices": [{"message": {"content": "{\"ok\":true}"}}]}`)

	_, err := prov.Inference(context.Background(), intelligence.InferenceRequest{
		Model:    "some/model",
		Messages: []intelligence.Message{{Role: "user", Content: "give me json"}},
		Schema:   json.RawMessage(`{"type":"object","properties":{"ok":{"type":"boolean"}}}`),
	})
	if err != nil {
		t.Fatalf("Inference: %v", err)
	}

	sent := rec.decode(t)
	rf, ok := sent["response_format"].(map[string]any)
	if !ok {
		t.Fatalf("response_format missing or wrong type: %v", sent["response_format"])
	}
	if rf["type"] != "json_schema" {
		t.Errorf("response_format.type = %v, want json_schema", rf["type"])
	}
	js, ok := rf["json_schema"].(map[string]any)
	if !ok || js["schema"] == nil {
		t.Errorf("json_schema.schema not forwarded: %v", rf["json_schema"])
	}
}

func TestOpenRouterReasoningTools(t *testing.T) {
	prov, rec := stubOpenRouter(t, `{
		"choices": [{"message": {
			"content": "",
			"tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "tool_1", "arguments": "{\"query\":\"orbit\"}"}}]
		}}]
	}`)
	definition := intelligence.ToolDefinition{
		Name:         "knowledge.search",
		Version:      "v1",
		Description:  "Search admitted Knowledge sources.",
		InputSchema:  json.RawMessage(`{"type":"object"}`),
		OutputSchema: json.RawMessage(`{"type":"object"}`),
	}

	response, err := prov.Reasoning(context.Background(), intelligence.ReasoningRequest{
		Model:    "reasoning/model",
		Messages: []intelligence.Message{{Role: "user", Content: "find orbit"}},
		Schema:   json.RawMessage(`{"type":"object","required":["answer"]}`),
		Tools:    []intelligence.ToolDefinition{definition},
	})
	if err != nil {
		t.Fatalf("Reasoning: %v", err)
	}
	if len(response.ToolCalls) != 1 {
		t.Fatalf("tool calls = %+v", response.ToolCalls)
	}
	call := response.ToolCalls[0]
	if call.ID != "call-1" || call.Name != "knowledge.search" || call.Version != "v1" || string(call.Arguments) != `{"query":"orbit"}` {
		t.Errorf("call = %+v", call)
	}

	sent := rec.decode(t)
	tools, ok := sent["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("tools = %v", sent["tools"])
	}
	tool, ok := tools[0].(map[string]any)
	if !ok || tool["type"] != "function" {
		t.Fatalf("tool = %v", tools[0])
	}
	function, ok := tool["function"].(map[string]any)
	if !ok || function["name"] != "tool_1" {
		t.Errorf("function = %v", tool["function"])
	}
	if !strings.Contains(function["description"].(string), "knowledge.search@v1") {
		t.Errorf("description = %v, want stable tool identity", function["description"])
	}
	if _, ok := sent["response_format"].(map[string]any); !ok {
		t.Errorf("response_format = %v, want structured-output schema alongside tools", sent["response_format"])
	}
}

func TestOpenRouterReasoningEncodesToolResultHistory(t *testing.T) {
	prov, rec := stubOpenRouter(t, `{"choices": [{"message": {"content": "done"}}]}`)
	definition := intelligence.ToolDefinition{
		Name:         "knowledge.search",
		Version:      "v1",
		Description:  "Search admitted Knowledge sources.",
		InputSchema:  json.RawMessage(`{"type":"object"}`),
		OutputSchema: json.RawMessage(`{"type":"object"}`),
	}
	_, err := prov.Reasoning(context.Background(), intelligence.ReasoningRequest{
		Model: "reasoning/model",
		Messages: []intelligence.Message{
			{Role: "user", Content: "find orbit"},
			{Role: "assistant", ToolCalls: []intelligence.ToolCall{{ID: "call-1", Name: "knowledge.search", Version: "v1", Arguments: json.RawMessage(`{"query":"orbit"}`)}}},
			{Role: "tool", ToolCallID: "call-1", Content: `{"callId":"call-1","ok":true,"output":{"matches":["orbit"]}}`},
		},
		Tools: []intelligence.ToolDefinition{definition},
	})
	if err != nil {
		t.Fatalf("Reasoning: %v", err)
	}
	messages, ok := rec.decode(t)["messages"].([]any)
	if !ok || len(messages) != 3 {
		t.Fatalf("messages = %v", messages)
	}
	assistant, _ := messages[1].(map[string]any)
	calls, _ := assistant["tool_calls"].([]any)
	if len(calls) != 1 {
		t.Fatalf("assistant tool calls = %v", assistant)
	}
	function := calls[0].(map[string]any)["function"].(map[string]any)
	if function["name"] != "tool_1" || function["arguments"] != `{"query":"orbit"}` {
		t.Errorf("function = %v", function)
	}
	tool, _ := messages[2].(map[string]any)
	if tool["role"] != "tool" || tool["tool_call_id"] != "call-1" {
		t.Errorf("tool result = %v", tool)
	}
}

func TestOpenRouterEmbed(t *testing.T) {
	prov, rec := stubOpenRouter(t, `{
		"data": [{"embedding": [0.1, 0.2]}, {"embedding": [0.3, 0.4]}],
		"usage": {"prompt_tokens": 5, "total_tokens": 5, "cost": 0.0004}
	}`)

	resp, err := prov.Embed(context.Background(), intelligence.EmbeddingRequest{
		Model:  "some/embed",
		Inputs: []string{"a", "b"},
	})
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if len(resp.Vectors) != 2 || resp.Vectors[1][0] != 0.3 {
		t.Errorf("vectors = %v, want two vectors with second starting 0.3", resp.Vectors)
	}
	if rec.path != "/embeddings" {
		t.Errorf("path = %q, want /embeddings", rec.path)
	}
	if resp.Usage.CostUSD != 0.0004 {
		t.Errorf("cost = %f, want provider-reported 0.0004", resp.Usage.CostUSD)
	}
}

func TestOpenRouterNoKey(t *testing.T) {
	prov := New("", "https://unused.example", 0)
	_, err := prov.Inference(context.Background(), intelligence.InferenceRequest{Model: "m", Messages: []intelligence.Message{{Role: "user", Content: "hi"}}})
	if !errors.Is(err, intelligence.ErrProviderNotConfigured) {
		t.Errorf("Inference with no key: err = %v, want intelligence.ErrProviderNotConfigured", err)
	}
	_, err = prov.Reasoning(context.Background(), intelligence.ReasoningRequest{Model: "m", Messages: []intelligence.Message{{Role: "user", Content: "hi"}}})
	if !errors.Is(err, intelligence.ErrProviderNotConfigured) {
		t.Errorf("Reasoning with no key: err = %v, want intelligence.ErrProviderNotConfigured", err)
	}
	_, err = prov.Embed(context.Background(), intelligence.EmbeddingRequest{Model: "m", Inputs: []string{"x"}})
	if !errors.Is(err, intelligence.ErrProviderNotConfigured) {
		t.Errorf("Embed with no key: err = %v, want intelligence.ErrProviderNotConfigured", err)
	}
}

// A 429 comes back as a typed RateLimited carrying the provider's Retry-After, so
// the capability waits the length the provider asked for instead of guessing. It
// still satisfies errors.Is(err, ErrRateLimited), which is what every existing
// caller checks.
func TestOpenRouterRateLimitCarriesRetryAfter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "42")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"error":{"message":"rate limit exceeded"}}`)
	}))
	t.Cleanup(srv.Close)
	prov := New("test-key", srv.URL, 0)

	_, err := prov.Embed(context.Background(), intelligence.EmbeddingRequest{Model: "m", Inputs: []string{"x"}})
	if !errors.Is(err, intelligence.ErrRateLimited) {
		t.Fatalf("err = %v, want it to satisfy errors.Is(err, ErrRateLimited)", err)
	}
	var rl *intelligence.RateLimited
	if !errors.As(err, &rl) {
		t.Fatalf("err = %v (%T), want a *intelligence.RateLimited", err, err)
	}
	if rl.RetryAfter != 42*time.Second {
		t.Errorf("RetryAfter = %s, want 42s", rl.RetryAfter)
	}
	if !strings.Contains(err.Error(), "rate limit exceeded") {
		t.Errorf("error = %q, want it to carry the provider's message", err)
	}
}

// A 429 with no Retry-After yields a zero delay, which the capability reads as
// "the provider did not say" and answers with its own backoff. Inventing a number
// here would put a guess where the absence of guidance belongs.
func TestOpenRouterRateLimitWithoutRetryAfter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"error":{"message":"slow down"}}`)
	}))
	t.Cleanup(srv.Close)
	prov := New("test-key", srv.URL, 0)

	_, err := prov.Embed(context.Background(), intelligence.EmbeddingRequest{Model: "m", Inputs: []string{"x"}})
	var rl *intelligence.RateLimited
	if !errors.As(err, &rl) {
		t.Fatalf("err = %v, want a *intelligence.RateLimited", err)
	}
	if rl.RetryAfter != 0 {
		t.Errorf("RetryAfter = %s, want zero when the provider named no delay", rl.RetryAfter)
	}
}

// parseRetryAfter takes both forms RFC 9110 allows, and refuses everything else.
//
// The refusals are the interesting half. A malformed header must never become a
// wait of unknown length, so anything unparseable, non-positive, or already past
// reads as "no guidance" — which is strictly safer than trusting a number nobody
// meant.
func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, 7, 29, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name string
		in   string
		want time.Duration
	}{
		{"delay seconds", "120", 2 * time.Minute},
		{"padded delay seconds", "  30  ", 30 * time.Second},
		{"http date in the future", now.Add(90 * time.Second).Format(http.TimeFormat), 90 * time.Second},
		{"http date in the past", now.Add(-time.Minute).Format(http.TimeFormat), 0},
		{"empty", "", 0},
		{"zero", "0", 0},
		{"negative", "-5", 0},
		{"nonsense", "soon", 0},
	} {
		if got := parseRetryAfter(tc.in, now); got != tc.want {
			t.Errorf("%s: parseRetryAfter(%q) = %s, want %s", tc.name, tc.in, got, tc.want)
		}
	}
}

// The provider's own timeout becomes ErrProviderTimeout, not something that looks
// like the caller giving up.
//
// This is the whole of the third defect. http.Client's Timeout surfaces as an
// error satisfying errors.Is(err, context.DeadlineExceeded) — indistinguishable in
// shape from an expired caller context — so the capability's shouldFallover read a
// slow provider as "the caller left" and abandoned the call with no retry and no
// fallback, exactly when the provider was busiest. Only this layer holds both the
// caller's context and the timeout it configured, so only this layer can tell them
// apart.
func TestOpenRouterOwnTimeoutIsTypedAsProviderTimeout(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release // hold the request open past the client's timeout
	}))
	t.Cleanup(func() { close(release); srv.Close() })
	prov := New("test-key", srv.URL, 50*time.Millisecond)

	_, err := prov.Embed(context.Background(), intelligence.EmbeddingRequest{Model: "m", Inputs: []string{"x"}})
	if !errors.Is(err, intelligence.ErrProviderTimeout) {
		t.Fatalf("err = %v, want it to satisfy errors.Is(err, ErrProviderTimeout)", err)
	}
}

// The caller's own cancellation is NOT reclassified. It is the other half of the
// same distinction: the caller's context is what decides, so a request the caller
// abandoned stays abandoned however slow the provider also was.
func TestOpenRouterCallerCancellationIsNotAProviderTimeout(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	t.Cleanup(func() { close(release); srv.Close() })
	// A generous client timeout, so the only deadline that can fire is the caller's.
	prov := New("test-key", srv.URL, time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err := prov.Embed(ctx, intelligence.EmbeddingRequest{Model: "m", Inputs: []string{"x"}})
	if errors.Is(err, intelligence.ErrProviderTimeout) {
		t.Fatalf("err = %v; a caller who gave up must not be reported as a provider timeout", err)
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, want the caller's deadline surfaced", err)
	}
}

func TestOpenRouterErrorResponse(t *testing.T) {
	rec := &recorded{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = rec
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":{"message":"bad model"}}`)
	}))
	t.Cleanup(srv.Close)
	prov := New("test-key", srv.URL, 0)

	_, err := prov.Inference(context.Background(), intelligence.InferenceRequest{Model: "nope", Messages: []intelligence.Message{{Role: "user", Content: "hi"}}})
	if err == nil {
		t.Fatal("expected an error for a non-2xx response")
	}
	if got := err.Error(); !strings.Contains(got, "bad model") {
		t.Errorf("error = %q, want it to mention the provider message", got)
	}
	if strings.Contains(err.Error(), "test-key") {
		t.Error("error leaked the API key")
	}
}

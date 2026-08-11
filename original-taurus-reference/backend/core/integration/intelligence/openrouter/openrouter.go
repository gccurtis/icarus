// Package openrouter implements the intelligence.Provider interface against
// OpenRouter's OpenAI-compatible completions and embeddings endpoints. The
// capability package sees only provider-neutral inference, reasoning, and tool
// types; provider mechanics — the HTTP calls, headers, the API key, and error
// shapes — stop here.
package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

// openRouterDefaultBaseURL is OpenRouter's public API root, used when the
// provider configuration leaves base_url blank.
const openRouterDefaultBaseURL = "https://openrouter.ai/api/v1"

// providerName is how this provider identifies itself in configuration and in the
// errors it returns. Name() answers with it too, so the two can never disagree.
const providerName = "openrouter"

// openRouter is the OpenRouter implementation of intelligence.Provider. It
// speaks the OpenAI-compatible chat-completions and embeddings endpoints
// OpenRouter serves.
type openRouter struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// providerTimeout is the default bound on a single provider HTTP call, used
// when configuration does not set one. Response speed is part of whether a
// model is usable for interactive work, so exceeding it is a real failure and
// not an accident to engineer around — claude-haiku-4.5 failed the live demo
// here, and that is the correct verdict rather than a reason to widen the gate.
// Override per provider with `timeout` in the manifest.
const providerTimeout = 60 * time.Second

// New builds the OpenRouter provider. A blank baseURL falls back to the public
// API root. A blank apiKey yields a provider that constructs fine but fails every
// call with intelligence.ErrProviderNotConfigured, so the server still starts
// without a key configured.
func New(apiKey, baseURL string, timeout time.Duration) intelligence.Provider {
	if baseURL == "" {
		baseURL = openRouterDefaultBaseURL
	}
	if timeout <= 0 {
		timeout = providerTimeout
	}
	return &openRouter{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: timeout},
	}
}

// Name identifies this provider in configuration and errors.
func (o *openRouter) Name() string { return providerName }

// Inference calls the message-only inference path. When the request carries a
// schema it asks for structured (json_schema) output.
func (o *openRouter) Inference(ctx context.Context, req intelligence.InferenceRequest) (intelligence.InferenceResponse, error) {
	if o.apiKey == "" {
		return intelligence.InferenceResponse{}, intelligence.ErrProviderNotConfigured
	}
	messages, err := openRouterMessages(req.Messages, nil)
	if err != nil {
		return intelligence.InferenceResponse{}, err
	}
	out, err := o.complete(ctx, req.Model, messages, req.Schema, nil, req.Effort)
	if err != nil {
		return intelligence.InferenceResponse{}, err
	}
	if len(out.Choices) == 0 {
		return intelligence.InferenceResponse{}, fmt.Errorf("openrouter: response contained no choices")
	}
	message := out.Choices[0].Message
	if len(message.ToolCalls) > 0 {
		return intelligence.InferenceResponse{}, fmt.Errorf("openrouter: inference response contained tool calls")
	}
	return intelligence.InferenceResponse{Content: message.Content, Usage: out.Usage.usage()}, nil
}

// Reasoning calls the reasoning path. It translates the fixed neutral tool set
// and any prior tool turns into OpenAI-compatible function-call fields, then
// maps the returned wire names back to their original name/version descriptors.
func (o *openRouter) Reasoning(ctx context.Context, req intelligence.ReasoningRequest) (intelligence.ReasoningResponse, error) {
	if o.apiKey == "" {
		return intelligence.ReasoningResponse{}, intelligence.ErrProviderNotConfigured
	}
	tools, names := openRouterTools(req.Tools)
	messages, err := openRouterMessages(req.Messages, names.byCore)
	if err != nil {
		return intelligence.ReasoningResponse{}, err
	}
	out, err := o.complete(ctx, req.Model, messages, req.Schema, tools, req.Effort)
	if err != nil {
		return intelligence.ReasoningResponse{}, err
	}
	if len(out.Choices) == 0 {
		return intelligence.ReasoningResponse{}, fmt.Errorf("openrouter: response contained no choices")
	}
	message := out.Choices[0].Message
	calls := make([]intelligence.ToolCall, len(message.ToolCalls))
	for i, call := range message.ToolCalls {
		calls[i] = intelligence.ToolCall{ID: call.ID, Arguments: json.RawMessage(call.Function.Arguments)}
		if definition, ok := names.byWire[call.Function.Name]; ok {
			calls[i].Name = definition.Name
			calls[i].Version = definition.Version
		} else {
			// Preserve an unrecognized wire name as an ordinary unknown core call.
			// The fixed ToolSet then returns a safe unknown_tool result; it never
			// routes this string to a handler.
			calls[i].Name = call.Function.Name
		}
	}
	return intelligence.ReasoningResponse{Content: message.Content, ToolCalls: calls, Usage: out.Usage.usage()}, nil
}

// openRouterCompletion is the small response projection shared by one-shot
// inference and reasoning calls. Tool-call arguments remain strings here because
// OpenAI-compatible APIs encode them as JSON text inside the function field.
type openRouterCompletion struct {
	Choices []struct {
		Message struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				ID       string `json:"id"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"message"`
	} `json:"choices"`
	Usage openRouterUsage `json:"usage"`
}

// complete sends one OpenAI-compatible completion request. The caller has
// already selected the endpoint mode and converted its neutral messages/tools.
func (o *openRouter) complete(ctx context.Context, model string, messages []map[string]any, schema json.RawMessage, tools []map[string]any, effort string) (openRouterCompletion, error) {
	payload := map[string]any{
		"model":    model,
		"messages": messages,
	}
	// A route may pin how hard the model thinks. OpenRouter normalizes this
	// across families (it maps to the vendor's own effort/thinking-budget
	// knob), and a model without one ignores it — so an unsupported effort
	// degrades to the model's default rather than failing the call.
	if effort != "" {
		payload["reasoning"] = map[string]any{"effort": effort}
	}
	if len(schema) > 0 {
		payload["response_format"] = map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "response",
				"strict": true,
				"schema": schema,
			},
		}
	}
	if len(tools) > 0 {
		payload["tools"] = tools
	}

	var out openRouterCompletion
	if err := o.post(ctx, "/chat/completions", payload, &out); err != nil {
		return openRouterCompletion{}, err
	}
	return out, nil
}

type openRouterToolNames struct {
	byCore map[string]string
	byWire map[string]intelligence.ToolDefinition
}

// openRouterTools assigns simple provider-safe function names for this one
// request. The adapter keeps the reversible map in memory, so provider naming
// limits cannot change the application's stable name/version contract.
func openRouterTools(definitions []intelligence.ToolDefinition) ([]map[string]any, openRouterToolNames) {
	tools := make([]map[string]any, len(definitions))
	names := openRouterToolNames{
		byCore: make(map[string]string, len(definitions)),
		byWire: make(map[string]intelligence.ToolDefinition, len(definitions)),
	}
	for i, definition := range definitions {
		wireName := fmt.Sprintf("tool_%d", i+1)
		names.byCore[openRouterToolKey(definition.Name, definition.Version)] = wireName
		names.byWire[wireName] = definition
		tools[i] = map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        wireName,
				"description": fmt.Sprintf("%s\n\nApplication tool: %s@%s", definition.Description, definition.Name, definition.Version),
				"parameters":  definition.InputSchema,
			},
		}
	}
	return tools, names
}

// openRouterMessages converts neutral message history to the provider's role
// fields. A historical assistant tool call must use the same request-local wire
// name mapping as the current descriptor list, or it is rejected before HTTP.
func openRouterMessages(messages []intelligence.Message, names map[string]string) ([]map[string]any, error) {
	out := make([]map[string]any, len(messages))
	for i, message := range messages {
		wire := map[string]any{"role": message.Role, "content": message.Content}
		if message.ToolCallID != "" {
			wire["tool_call_id"] = message.ToolCallID
		}
		if len(message.ToolCalls) > 0 {
			calls := make([]map[string]any, len(message.ToolCalls))
			for j, call := range message.ToolCalls {
				wireName, ok := names[openRouterToolKey(call.Name, call.Version)]
				if !ok {
					return nil, fmt.Errorf("openrouter: history references unavailable tool %s@%s", call.Name, call.Version)
				}
				calls[j] = map[string]any{
					"id":   call.ID,
					"type": "function",
					"function": map[string]any{
						"name":      wireName,
						"arguments": string(call.Arguments),
					},
				}
			}
			wire["tool_calls"] = calls
		}
		out[i] = wire
	}
	return out, nil
}

func openRouterToolKey(name, version string) string { return name + "\x00" + version }

// Embed calls the embeddings endpoint, returning one vector per input in order.
func (o *openRouter) Embed(ctx context.Context, req intelligence.EmbeddingRequest) (intelligence.EmbeddingResponse, error) {
	if o.apiKey == "" {
		return intelligence.EmbeddingResponse{}, intelligence.ErrProviderNotConfigured
	}
	payload := map[string]any{
		"model": req.Model,
		"input": req.Inputs,
	}

	var out struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
		Usage openRouterUsage `json:"usage"`
	}
	if err := o.post(ctx, "/embeddings", payload, &out); err != nil {
		return intelligence.EmbeddingResponse{}, err
	}
	vectors := make([][]float64, len(out.Data))
	for i, d := range out.Data {
		vectors[i] = d.Embedding
	}
	return intelligence.EmbeddingResponse{Vectors: vectors, Usage: out.Usage.usage()}, nil
}

// openRouterUsage mirrors the API's snake_case usage block; usage converts it to
// the neutral intelligence.Usage type.
type openRouterUsage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens      int     `json:"total_tokens"`
	CostUSD          float64 `json:"cost"`
	// CompletionTokensDetails breaks the completion count down. Reasoning tokens
	// are the share a reasoning model spent thinking before it answered; they are
	// part of completion_tokens, not additional to it, and are billed at the
	// completion rate. Absent for models that do not reason, which reads as zero.
	CompletionTokensDetails struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

func (u openRouterUsage) usage() intelligence.Usage {
	return intelligence.Usage{
		PromptTokens:     u.PromptTokens,
		CompletionTokens: u.CompletionTokens,
		ReasoningTokens:  u.CompletionTokensDetails.ReasoningTokens,
		TotalTokens:      u.TotalTokens,
		CostUSD:          u.CostUSD,
	}
}

// post sends payload to a path under the base URL and decodes a 2xx response
// into out. It sets the bearer credential and OpenRouter's recommended
// attribution headers. A non-2xx response becomes a sanitized error — the key
// travels only in the request header, never in the body, so nothing here can
// leak it.
func (o *openRouter) post(ctx context.Context, path string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("openrouter: encode request: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("openrouter: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)
	httpReq.Header.Set("HTTP-Referer", "https://github.com/gccurtis/taurus-omega")
	httpReq.Header.Set("X-Title", "Taurus Omega")

	resp, err := o.client.Do(httpReq)
	if err != nil {
		// Our own client Timeout and the caller's context expiring are
		// indistinguishable by shape: both surface as a net.Error reporting Timeout()
		// and both satisfy errors.Is(err, context.DeadlineExceeded). The only thing
		// that separates them is asking the caller's context, which is why the
		// distinction has to be drawn here — this is the only layer that holds both
		// the context and the knowledge of which deadline it configured.
		//
		// It is load-bearing rather than cosmetic. The capability abandons a call the
		// caller gave up on and RETRIES one the provider was merely too slow to
		// answer; before this, the latter took the former's path and gave up
		// immediately — precisely when a busy provider most needed to be asked again.
		var ne net.Error
		if ctx.Err() == nil && errors.As(err, &ne) && ne.Timeout() {
			return fmt.Errorf("openrouter: %w after %s: %v", intelligence.ErrProviderTimeout, o.client.Timeout, err)
		}
		return fmt.Errorf("openrouter: request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("openrouter: read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// A 429 becomes a typed RateLimited carrying the provider's own Retry-After,
		// so the capability can tell "wait" apart from "this will never work" AND wait
		// the length the provider actually asked for. Guessing is strictly worse: the
		// provider knows when its window resets and we do not. Everything else stays an
		// opaque error, because everything else fails the same way on the next attempt.
		if resp.StatusCode == http.StatusTooManyRequests {
			return &intelligence.RateLimited{
				RetryAfter: parseRetryAfter(resp.Header.Get("Retry-After"), time.Now()),
				Provider:   providerName,
				Detail:     openRouterError(data),
			}
		}
		return fmt.Errorf("openrouter: %s: %s", resp.Status, openRouterError(data))
	}
	// A 2xx can still carry an error. The embeddings endpoint answers a batch
	// containing an empty string with HTTP 200, an empty data array, and an
	// error object explaining the rejection — so trusting the status alone turns
	// a rejected request into a silently empty result. Treat a populated error
	// field as the failure it is, whatever the status said.
	if msg := declaredError(data); msg != "" {
		return fmt.Errorf("openrouter: %s (HTTP %d)", msg, resp.StatusCode)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("openrouter: decode response: %w", err)
	}
	return nil
}

// parseRetryAfter reads an HTTP Retry-After header. RFC 9110 allows two forms —
// delay-seconds ("120") or an HTTP-date — and providers use both, so both are
// accepted. now is passed in rather than read here so the date form is testable.
//
// Anything unparseable, non-positive, or already in the past yields zero, which
// the capability reads as "the provider did not say" and answers with its own
// backoff. That direction of failure is deliberate: a malformed header must never
// become a wait of unknown length, and treating a garbled value as "no guidance"
// is strictly safer than trusting a number nobody meant.
func parseRetryAfter(v string, now time.Time) time.Duration {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0
	}
	if secs, err := strconv.Atoi(v); err == nil {
		if secs <= 0 {
			return 0
		}
		return time.Duration(secs) * time.Second
	}
	if at, err := http.ParseTime(v); err == nil {
		if d := at.Sub(now); d > 0 {
			return d
		}
	}
	return 0
}

// openRouterError extracts a human-readable message from an error response body,
// falling back to a bounded raw snippet. OpenRouter proxies to an upstream
// provider, so its top-level message is often a generic "Provider returned
// error" while the real cause (a rejected schema, a bad parameter) sits in
// error.metadata: the upstream provider name and its raw error. We include those
// so a failure is diagnosable from the log alone. The body never contains the
// API key.
//
// declaredError returns the message from a populated error object, or "" when
// the body declares no error. Unlike openRouterError it never falls back to
// echoing the body, because it is asked about SUCCESS responses too: a snippet
// of a perfectly good payload must not read as a failure.
func declaredError(data []byte) string {
	var e struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(data, &e) != nil {
		return ""
	}
	if strings.TrimSpace(e.Error.Message) == "" {
		return ""
	}
	return openRouterError(data)
}

func openRouterError(data []byte) string {
	var e struct {
		Error struct {
			Message  string `json:"message"`
			Metadata struct {
				ProviderName string          `json:"provider_name"`
				Raw          json.RawMessage `json:"raw"`
			} `json:"metadata"`
		} `json:"error"`
	}
	if json.Unmarshal(data, &e) == nil && e.Error.Message != "" {
		msg := e.Error.Message
		if e.Error.Metadata.ProviderName != "" {
			msg += " (provider " + e.Error.Metadata.ProviderName + ")"
		}
		if raw := upstreamErrorMessage(e.Error.Metadata.Raw); raw != "" {
			msg += ": " + raw
		}
		return msg
	}
	msg := strings.TrimSpace(string(data))
	if len(msg) > 200 {
		msg = msg[:200]
	}
	if msg == "" {
		msg = "no response body"
	}
	return msg
}

// upstreamErrorMessage pulls the upstream provider's own error message out of the
// metadata.raw field, which OpenRouter passes through as a JSON-encoded string
// (an object with its own {error:{message}}). It falls back to a bounded snippet
// of whatever raw text is present.
func upstreamErrorMessage(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	// metadata.raw is usually a JSON string containing the upstream body.
	var inner string
	if json.Unmarshal(raw, &inner) != nil {
		inner = string(raw)
	}
	var nested struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal([]byte(inner), &nested) == nil && nested.Error.Message != "" {
		return nested.Error.Message
	}
	inner = strings.TrimSpace(inner)
	if len(inner) > 300 {
		inner = inner[:300]
	}
	return inner
}

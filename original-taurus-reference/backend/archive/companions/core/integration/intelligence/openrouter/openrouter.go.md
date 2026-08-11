# openrouter.go

`openrouter.go` adapts the provider-neutral Intelligence contract to OpenRouter's OpenAI-compatible completion and embeddings endpoints. It is the only place that knows the native function-call payload shape or the provider-safe temporary function names.

## Code breakdown

### OpenRouter inference, reasoning, tool translation, and HTTP transport

```go
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
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

// openRouterDefaultBaseURL is OpenRouter's public API root, used when the
// provider configuration leaves base_url blank.
const openRouterDefaultBaseURL = "https://openrouter.ai/api/v1"

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
// not an accident to engineer around. Override per provider with `timeout`.
const providerTimeout = 60 * time.Second

// New builds the OpenRouter provider. A blank baseURL falls back to the public
// API root. A blank apiKey yields a provider that constructs fine but fails every
// call with intelligence.ErrProviderNotConfigured, so the server still starts
// without a key configured.
func New(apiKey, baseURL string, timeout time.Duration) intelligence.Provider {
	if baseURL == "" {
		baseURL = openRouterDefaultBaseURL
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
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	// Reasoning tokens are part of completion_tokens, not additional to it, and
	// bill at the completion rate. Absent for models that do not reason.
	CompletionTokensDetails struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
	TotalTokens int `json:"total_tokens"`
}

func (u openRouterUsage) usage() intelligence.Usage {
	return intelligence.Usage{
		PromptTokens:     u.PromptTokens,
		CompletionTokens: u.CompletionTokens,
		ReasoningTokens:  u.CompletionTokensDetails.ReasoningTokens,
		TotalTokens:      u.TotalTokens,
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
		// indistinguishable by shape; only the caller's context separates them.
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
		if resp.StatusCode == http.StatusTooManyRequests {
			return &intelligence.RateLimited{
				RetryAfter: parseRetryAfter(resp.Header.Get("Retry-After"), time.Now()),
				Provider:   providerName,
				Detail:     openRouterError(data),
			}
		}
		return fmt.Errorf("openrouter: %s: %s", resp.Status, openRouterError(data))
	}
	// A 2xx can still declare an error — see the section below.
	if msg := declaredError(data); msg != "" {
		return fmt.Errorf("openrouter: %s (HTTP %d)", msg, resp.StatusCode)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("openrouter: decode response: %w", err)
	}
	return nil
}

// openRouterError extracts a human-readable message from an error response body,
// falling back to a bounded raw snippet. OpenRouter proxies to an upstream
// provider, so its top-level message is often a generic "Provider returned
// error" while the real cause (a rejected schema, a bad parameter) sits in
// error.metadata: the upstream provider name and its raw error. We include those
// so a failure is diagnosable from the log alone. The body never contains the
// API key.
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
```

The adapter maps each request-local wire function name back to the stable application descriptor before control returns to Intelligence. Unknown names remain unknown core calls, so the fixed `ToolSet` can reject them without accidental handler routing.

### A 429 is typed, and carries the delay the provider asked for

`post` answers a 429 with an `*intelligence.RateLimited` — the provider's own
`Retry-After`, this provider's name, and its message — and leaves every other
non-2xx as a plain error. The asymmetry is deliberate: the capability's response to
a rate limit is genuinely different — wait and ask the same model again — while
every other failure will fail identically on the next attempt, so nothing above
would act differently for knowing which one it was.

The delay travels because honouring it beats guessing in both directions. The
provider knows when its window resets and we do not, and a guess that comes in
*short* walks straight back into the limit. `RateLimited` unwraps to
`ErrRateLimited`, so every existing `errors.Is` check is unaffected by the type
becoming richer.

### `parseRetryAfter` — two legal forms, and a safe direction to fail

RFC 9110 allows `Retry-After` as delay-seconds or as an HTTP-date, and providers
use both, so both are accepted. `now` is a parameter rather than a call to
`time.Now` inside, which is what makes the date form testable.

Everything else yields **zero** — unparseable, non-positive, or a date already
past. The capability reads zero as "the provider named no delay" and falls back to
its own backoff, so the failure direction is the safe one: a malformed header can
never become a wait of unknown length, and treating a garbled value as absence of
guidance is strictly better than trusting a number nobody meant.

### The provider's own timeout is named, because nothing else can name it

When `client.Do` fails, `post` asks the **caller's context** whether it is still
alive. If it is, and the error reports `Timeout()`, this was our own
`http.Client.Timeout` and it returns `intelligence.ErrProviderTimeout`; otherwise
the error passes through as-is.

The distinction cannot be drawn anywhere else. An `http.Client`'s own timeout
surfaces as a `net.Error` reporting `Timeout()` and satisfying
`errors.Is(err, context.DeadlineExceeded)` — the same shape as the caller's context
expiring — and this is the one layer holding both the caller's context and the
deadline it configured.

It is load-bearing rather than cosmetic. The capability abandons a call the caller
gave up on and **retries** one the provider was merely too slow to answer. Before
this, the latter took the former's path: a slow provider failed with no retry and no
fallover, at exactly the moment a busy provider most needed asking again.

Note the timeout error wraps `ErrProviderTimeout` with `%w` but the underlying
error with `%v`. That keeps the message complete while leaving only one sentinel
matchable, so nothing downstream can match `context.DeadlineExceeded` through it
and undo the distinction this arm exists to make.

### A 2xx can still carry an error

`post` checks the status first, then checks for a declared error object even on
success. This is not belt-and-braces: the embeddings endpoint answers a batch
containing an empty string with **HTTP 200**, an empty `data` array, and an
`error` explaining the rejection. Trusting the status alone turned a rejected
request into a silently empty result, which downstream code indexed by position
and panicked on.

`declaredError` exists separately from `openRouterError` for one reason:
`openRouterError` falls back to echoing a snippet of the body when it finds no
structured message, which is right for a known failure and catastrophic here —
asked about a successful response it would return part of the payload, and every
good call would look like an error. `declaredError` returns a message only when
the error object is actually populated.

### Reasoning tokens are decoded from the completion breakdown

OpenRouter reports a reasoning model's thinking budget in
`completion_tokens_details.reasoning_tokens`, nested inside the usage block
rather than beside the top-level counts. The nesting is meaningful and the
decoder preserves it: reasoning tokens are a **share of** `completion_tokens`,
not a separate category, and they bill at the completion rate.

Decoding it into a nested anonymous struct rather than flattening it to a
top-level field keeps that relationship visible at the wire boundary, where a
future reader is most likely to reach for the wrong arithmetic. A model that does
not reason omits the object entirely, which decodes to zero — the same value a
non-reasoning model would report if it did send it.

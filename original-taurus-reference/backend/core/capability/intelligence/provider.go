package intelligence

import (
	"context"
	"encoding/json"
)

// Message is one turn in a one-shot inference or reasoning exchange. Role is
// "system", "user", "assistant", or "tool". ToolCalls are present only on an
// assistant turn that requested tools; ToolCallID links a tool result to that
// request. Provider adapters translate these neutral fields to their wire form.
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []ToolCall `json:"-"`
	ToolCallID string     `json:"-"`
}

// Usage reports the token consumption a provider attributes to a call. Fields
// are zero when the provider does not report them.
type Usage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	// ReasoningTokens is the share of CompletionTokens a reasoning model spent
	// thinking before it answered. It is part of the completion count rather than
	// additional to it, and is billed at the completion rate, so it never enters a
	// cost calculation separately — it is reported because it says where the
	// output budget actually went. Zero for models that do not reason.
	ReasoningTokens int `json:"reasoningTokens,omitempty"`
	TotalTokens     int `json:"totalTokens"`
	Requests        int `json:"requests,omitempty"`
	// CostUSD is the provider-reported charge for the call. It remains zero when
	// a provider cannot report price; callers must not infer a model price from
	// token counts.
	CostUSD float64 `json:"costUsd,omitempty"`
}

// InferenceRequest is a provider-neutral, one-shot inference request. Schema,
// when set, asks the provider to constrain its output to that JSON schema;
// inference deliberately does not carry tools in this increment.
type InferenceRequest struct {
	Model    string
	Messages []Message
	Schema   json.RawMessage
	// Effort optionally pins how much reasoning the provider spends
	// ("low"|"medium"|"high"); empty leaves the provider default. It comes from
	// the resolved route, not from the caller.
	Effort string
}

// InferenceResponse is an inference result: the assistant content and the
// call's token usage.
type InferenceResponse struct {
	Content string
	Usage   Usage
}

// ReasoningRequest is a provider-neutral, one-shot reasoning request. Tools is
// the fixed set visible for this call; a provider returns requested operations
// as ToolCalls in the corresponding response.
type ReasoningRequest struct {
	Model    string
	Messages []Message
	Schema   json.RawMessage
	Tools    []ToolDefinition
	// Effort optionally pins how much reasoning the provider spends
	// ("low"|"medium"|"high"); empty leaves the provider default. It comes from
	// the resolved route, not from the caller.
	Effort string
}

// ReasoningResponse is a reasoning result. A final response has no ToolCalls;
// otherwise Content and ToolCalls form the assistant turn to continue from.
type ReasoningResponse struct {
	Content   string
	ToolCalls []ToolCall
	Usage     Usage
}

// EmbeddingRequest is a provider-neutral embedding request: one model over a
// batch of input strings.
type EmbeddingRequest struct {
	Model  string
	Inputs []string
}

// EmbeddingResponse is the provider's embedding result: one vector per input,
// in input order, and the call's token usage.
type EmbeddingResponse struct {
	Vectors [][]float64
	Usage   Usage
}

// Provider is the boundary to a single model backend. Inference backs the
// message-only inference endpoint, Reasoning backs the reasoning endpoint and
// its bounded tool loop, and Embed backs embeddings. Implementations must never
// include their credential in a returned error.
type Provider interface {
	// Name identifies the provider (matches its configuration key).
	Name() string
	Inference(ctx context.Context, req InferenceRequest) (InferenceResponse, error)
	Reasoning(ctx context.Context, req ReasoningRequest) (ReasoningResponse, error)
	Embed(ctx context.Context, req EmbeddingRequest) (EmbeddingResponse, error)
}

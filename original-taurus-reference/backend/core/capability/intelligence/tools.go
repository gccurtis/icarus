package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ToolDefinition is the stable, provider-neutral description of one application
// tool. Name and Version identify the contract; the schemas are JSON Schema
// documents sent to a model and used by the owning handler as its input/output
// contract.
type ToolDefinition struct {
	Name         string          `json:"name"`
	Version      string          `json:"version"`
	Description  string          `json:"description"`
	InputSchema  json.RawMessage `json:"inputSchema"`
	OutputSchema json.RawMessage `json:"outputSchema"`
}

// ToolCall is one operation a reasoning provider requested. Arguments remain
// raw JSON until the selected predefined handler decodes its own contract.
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Version   string          `json:"version"`
	Arguments json.RawMessage `json:"arguments"`
}

// ToolError is safe, structured feedback returned to a model for a rejected or
// failed tool call. Handlers may return one directly; other handler errors are
// deliberately reduced to the generic tool_failed response.
type ToolError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ToolError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message == "" {
		return e.Code
	}
	return e.Code + ": " + e.Message
}

// ToolResult is the normalized result of satisfying one ToolCall. Output is
// valid JSON only when OK is true. The loop returns every result to the model as
// a tool-role message and also records it in ToolResponse for the caller.
type ToolResult struct {
	CallID    string          `json:"callId"`
	Name      string          `json:"name"`
	Version   string          `json:"version"`
	OK        bool            `json:"ok"`
	Output    json.RawMessage `json:"output,omitempty"`
	Error     *ToolError      `json:"error,omitempty"`
	Truncated bool            `json:"truncated,omitempty"`
}

// ToolHandler is an in-process function paired with one ToolDefinition by
// application code. A Project-aware capability binds the current Project in the
// closure that implements this function; model arguments never select a Project.
type ToolHandler func(context.Context, json.RawMessage) (json.RawMessage, error)

// ToolBinding pairs a public descriptor with its private predefined handler.
// It is assembled by application code, never from a request or user setting.
type ToolBinding struct {
	Definition ToolDefinition
	Handler    ToolHandler
}

type toolKey struct {
	name    string
	version string
}

// ToolRef is the stable key used when application composition declares a tool
// mandatory for a particular call profile.
type ToolRef struct {
	Name    string
	Version string
}

// ToolSet is an immutable per-call view of predefined application bindings. It
// has no registration API: NewToolSet validates a fixed list once and only
// exposes cloned definitions and bounded execution afterward.
type ToolSet struct {
	bindings    map[toolKey]ToolBinding
	definitions []ToolDefinition
}

// NewToolSet validates and freezes a fixed set of predefined bindings. Duplicate
// name/version pairs, malformed schemas, and missing handlers fail before a
// model can receive any descriptor.
func NewToolSet(bindings ...ToolBinding) (ToolSet, error) {
	set := ToolSet{
		bindings:    make(map[toolKey]ToolBinding, len(bindings)),
		definitions: make([]ToolDefinition, 0, len(bindings)),
	}
	for _, binding := range bindings {
		if err := validateToolDefinition(binding.Definition); err != nil {
			return ToolSet{}, err
		}
		if binding.Handler == nil {
			return ToolSet{}, fmt.Errorf("intelligence: tool %s@%s has no handler", binding.Definition.Name, binding.Definition.Version)
		}
		key := toolKey{name: binding.Definition.Name, version: binding.Definition.Version}
		if _, exists := set.bindings[key]; exists {
			return ToolSet{}, fmt.Errorf("intelligence: duplicate tool %s@%s", key.name, key.version)
		}
		binding.Definition = cloneToolDefinition(binding.Definition)
		set.bindings[key] = binding
		set.definitions = append(set.definitions, cloneToolDefinition(binding.Definition))
	}
	return set, nil
}

// Empty reports whether this call has no visible tools.
func (s ToolSet) Empty() bool { return len(s.definitions) == 0 }

// Definitions returns a copy of the fixed descriptors visible to this call. The
// returned slice and schemas may be changed by the caller without mutating the
// ToolSet or widening the handlers it can execute.
func (s ToolSet) Definitions() []ToolDefinition {
	definitions := make([]ToolDefinition, len(s.definitions))
	for i, definition := range s.definitions {
		definitions[i] = cloneToolDefinition(definition)
	}
	return definitions
}

// ValidateRequired rejects an immutable set that is missing any tool promised
// by its application profile. NewToolSet already rejects duplicate keys and
// incomplete definitions/handlers; this supplies the matching missing-key gate.
func (s ToolSet) ValidateRequired(required ...ToolRef) error {
	seen := make(map[toolKey]bool, len(required))
	for _, ref := range required {
		key := toolKey{name: strings.TrimSpace(ref.Name), version: strings.TrimSpace(ref.Version)}
		if key.name == "" || key.version == "" {
			return errors.New("intelligence: required tool name and version are required")
		}
		if seen[key] {
			return fmt.Errorf("intelligence: required tool %s@%s is listed more than once", key.name, key.version)
		}
		seen[key] = true
		if _, ok := s.bindings[key]; !ok {
			return fmt.Errorf("intelligence: required tool %s@%s is not registered", key.name, key.version)
		}
	}
	return nil
}

// ToolLimits cap a single ReasonWithTools request. Zero values use the hard
// defaults; positive values can tighten a ceiling but cannot raise it. Context
// cancellation supplies the wall-clock bound.
type ToolLimits struct {
	MaxRounds        int
	MaxCallsPerRound int
	MaxCalls         int
	MaxArgumentBytes int
	MaxResultBytes   int
	MaxTotalTokens   int
}

// hardToolLimits are the fixed ceilings. A
// deployment can pass lower values for a request, but no caller or model can
// raise them. Sized for DOCUMENT AUTHORING, which is a headline use case: an
// agent writing a structured document appends roughly one block per round, so a
// 16-round ceiling capped it at a title, three sections and little else — a live
// run asking for a 400-word story exhausted it and failed the task outright.
// configure a larger envelope through this API.
var hardToolLimits = ToolLimits{
	MaxRounds:        64,
	MaxCallsPerRound: 8,
	MaxCalls:         256,
	MaxArgumentBytes: 64 * 1024,
	MaxResultBytes:   128 * 1024,
	MaxTotalTokens:   512 * 1024,
}

// DefaultToolLimits returns a copy of the fixed ceilings. Returning a value,
// rather than exposing mutable package state, keeps the hard envelope intact.
func DefaultToolLimits() ToolLimits { return hardToolLimits }

// ErrToolCallsNotEnabled rejects a tool request returned by an ordinary one-shot
// Reason call. ErrToolLimitExceeded terminates a bounded loop before another
// provider or handler call can cross its configured envelope.
var (
	ErrToolCallsNotEnabled = errors.New("intelligence reasoning call requested tools without a tool loop")
	ErrToolLimitExceeded   = errors.New("intelligence tool limit exceeded")
)

// effective returns the non-escalatable request limits.
func (l ToolLimits) effective() ToolLimits {
	return ToolLimits{
		MaxRounds:        boundedLimit(l.MaxRounds, hardToolLimits.MaxRounds),
		MaxCallsPerRound: boundedLimit(l.MaxCallsPerRound, hardToolLimits.MaxCallsPerRound),
		MaxCalls:         boundedLimit(l.MaxCalls, hardToolLimits.MaxCalls),
		MaxArgumentBytes: boundedLimit(l.MaxArgumentBytes, hardToolLimits.MaxArgumentBytes),
		MaxResultBytes:   boundedLimit(l.MaxResultBytes, hardToolLimits.MaxResultBytes),
		MaxTotalTokens:   boundedLimit(l.MaxTotalTokens, hardToolLimits.MaxTotalTokens),
	}
}

func boundedLimit(requested, ceiling int) int {
	if requested <= 0 || requested > ceiling {
		return ceiling
	}
	return requested
}

// Execute resolves a call only against this fixed ToolSet. Rejections and normal
// handler failures become safe ToolResults; context cancellation is returned so
// the loop cannot continue after its caller has stopped waiting.
func (s ToolSet) Execute(ctx context.Context, call ToolCall, limits ToolLimits) (ToolResult, error) {
	if err := ctx.Err(); err != nil {
		return ToolResult{}, err
	}
	limits = limits.effective()
	result := ToolResult{CallID: call.ID, Name: call.Name, Version: call.Version}
	if call.ID == "" {
		return ToolResult{}, fmt.Errorf("intelligence: provider returned a tool call without an id")
	}
	binding, ok := s.bindings[toolKey{name: call.Name, version: call.Version}]
	if !ok {
		result.Error = &ToolError{Code: "unknown_tool", Message: "tool is not available to this request"}
		return result, nil
	}
	if len(call.Arguments) > limits.MaxArgumentBytes {
		result.Error = &ToolError{Code: "arguments_too_large", Message: "tool arguments exceed the configured byte limit"}
		return result, nil
	}
	if !json.Valid(call.Arguments) {
		result.Error = &ToolError{Code: "invalid_arguments", Message: "tool arguments must be valid JSON"}
		return result, nil
	}

	output, err := binding.Handler(ctx, cloneRaw(call.Arguments))
	if ctxErr := ctx.Err(); ctxErr != nil {
		return ToolResult{}, ctxErr
	}
	if err != nil {
		var toolErr *ToolError
		if errors.As(err, &toolErr) && toolErr != nil {
			result.Error = &ToolError{Code: toolErr.Code, Message: toolErr.Message}
		} else {
			result.Error = &ToolError{Code: "tool_failed", Message: "tool execution failed"}
		}
		return result, nil
	}
	if len(output) > limits.MaxResultBytes {
		result.Error = &ToolError{Code: "result_too_large", Message: "tool result exceeds the configured byte limit"}
		return result, nil
	}
	if !json.Valid(output) {
		result.Error = &ToolError{Code: "invalid_result", Message: "tool returned invalid JSON"}
		return result, nil
	}
	result.OK = true
	result.Output = cloneRaw(output)
	return result, nil
}

func validateToolDefinition(definition ToolDefinition) error {
	if strings.TrimSpace(definition.Name) == "" || strings.TrimSpace(definition.Version) == "" {
		return errors.New("intelligence: tool name and version are required")
	}
	if strings.TrimSpace(definition.Description) == "" {
		return fmt.Errorf("intelligence: tool %s@%s has no description", definition.Name, definition.Version)
	}
	if err := validateSchema(definition.InputSchema); err != nil {
		return fmt.Errorf("intelligence: tool %s@%s input schema: %w", definition.Name, definition.Version, err)
	}
	if err := validateSchema(definition.OutputSchema); err != nil {
		return fmt.Errorf("intelligence: tool %s@%s output schema: %w", definition.Name, definition.Version, err)
	}
	return nil
}

func validateSchema(schema json.RawMessage) error {
	if !json.Valid(schema) {
		return errors.New("must be valid JSON")
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(schema, &object); err != nil || object == nil {
		return errors.New("must be a JSON object")
	}
	return nil
}

func cloneToolDefinition(definition ToolDefinition) ToolDefinition {
	definition.InputSchema = cloneRaw(definition.InputSchema)
	definition.OutputSchema = cloneRaw(definition.OutputSchema)
	return definition
}

func cloneRaw(raw json.RawMessage) json.RawMessage {
	return append(json.RawMessage(nil), raw...)
}

func cloneToolCalls(calls []ToolCall) []ToolCall {
	cloned := make([]ToolCall, len(calls))
	for i, call := range calls {
		cloned[i] = call
		cloned[i].Arguments = cloneRaw(call.Arguments)
	}
	return cloned
}

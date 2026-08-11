package intelligence

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// ToolRequest asks the reasoning endpoint to continue through a fixed set of
// predefined application tools. The caller chooses the cast, messages, ToolSet,
// and non-escalatable limits; a model cannot add a tool or Project scope.
type ToolRequest struct {
	Cast     Cast
	Messages []Message
	Tools    ToolSet
	Limits   ToolLimits
}

// ToolResponse records the final reasoning output and the complete normalized
// exchange. A plain call sets Text; a structured call sets JSON. Rounds counts
// completed tool-execution rounds; Calls counts every returned ToolCall,
// including calls rejected before reaching a handler.
type ToolResponse struct {
	Text        string
	JSON        json.RawMessage
	Messages    []Message
	ToolResults []ToolResult
	Usage       Usage
	Rounds      int
	Calls       int
}

// ReasonWithTools runs the bounded provider → predefined handler → provider
// continuation loop for a plain-text result. It intentionally exists only on
// Reasoning: Inference is a single message-only operation in this first
// implementation.
func (in *Intelligence) ReasonWithTools(ctx context.Context, req ToolRequest) (ToolResponse, error) {
	return in.reasonWithTools(ctx, req, nil)
}

// ReasonWithToolsJSON is ReasonWithTools with the final assistant output
// constrained to schema. The same schema is sent on every continuation, so a
// provider cannot switch the final result shape after a tool call.
func (in *Intelligence) ReasonWithToolsJSON(ctx context.Context, req ToolRequest, schema json.RawMessage) (ToolResponse, error) {
	return in.reasonWithTools(ctx, req, ensureSchema(schema))
}

// reasonWithTools is the shared bounded continuation implementation. A nil
// schema selects free text; a non-empty schema selects validated JSON.
func (in *Intelligence) reasonWithTools(ctx context.Context, req ToolRequest, schema json.RawMessage) (_ ToolResponse, retErr error) {
	candidates, err := in.candidates(KindReasoning, req.Cast)
	if err != nil {
		return ToolResponse{}, err
	}
	limits := req.Limits.effective()
	messages := cloneMessages(req.Messages)
	response := ToolResponse{}
	// locked is nil until the first provider call succeeds. While nil, a failed
	// call falls over to the next candidate; once a route has answered, every
	// later round uses that same route — a provider-specific conversation cannot
	// be resumed elsewhere, and tools have by then executed, so re-running under a
	// different model would repeat their side effects.
	var locked *Route

	// One event for the whole loop rather than one per round: the loop is the unit
	// a caller waited on and paid for, and its rounds and tool-call counts only
	// mean anything as totals. Deferred because the loop has many exits — a limit
	// trip and an unusable final answer are precisely the outcomes worth measuring,
	// and an early return must not be the one case that goes unrecorded.
	// retErr is a named return so every exit — including the early ones — is seen
	// here without each having to remember to report itself.
	started := time.Now()
	// toolTime accumulates only the handlers' own execution, so a loop's wall-clock
	// can be split into time waiting on the model and time doing local work. Without
	// the split a slow loop is unattributable: a model that thinks for 20s and a
	// tool that takes 20s look identical from the outside.
	var toolTime time.Duration
	defer func() {
		event := CallEvent{
			Operation: "reason.tools", Subject: subjectFrom(ctx), Cast: req.Cast.String(),
			Duration: time.Since(started), ToolDuration: toolTime, Usage: response.Usage,
			Rounds: response.Rounds, Calls: response.Calls,
		}
		if locked != nil {
			event.Provider, event.Model, event.Effort = locked.Provider, locked.Model, locked.Effort
		}
		if retErr != nil {
			event.Err = retErr.Error()
		}
		in.record(event)
	}()

	for {
		if err := ctx.Err(); err != nil {
			return response, err
		}
		turn, used, err := in.reasoningTurn(ctx, candidates, locked, ReasoningRequest{
			Messages: cloneMessages(messages),
			Schema:   schema,
			Tools:    req.Tools.Definitions(),
		})
		if err != nil {
			return response, err
		}
		locked = &used
		response.Usage = addUsage(response.Usage, turn.Usage)
		if usageTokens(response.Usage) > limits.MaxTotalTokens {
			return response, toolLimitError("total_tokens")
		}
		if len(turn.ToolCalls) == 0 {
			messages = append(messages, Message{Role: "assistant", Content: turn.Content})
			if len(schema) == 0 {
				response.Text = turn.Content
			} else {
				// No fall-over here: tools have already run, so re-running this
				// under another model would repeat their side effects. That makes
				// accepting a usable answer more important, not less — and when it
				// really is unusable, the error has to say what came back.
				payload, ok := extractJSON(turn.Content)
				if !ok {
					return response, fmt.Errorf("intelligence: model %q returned no usable JSON for a structured tool call: %s",
						used.Model, truncateForError(turn.Content))
				}
				response.JSON = payload
			}
			response.Messages = cloneMessages(messages)
			return response, nil
		}
		if response.Rounds >= limits.MaxRounds {
			return response, toolLimitError("rounds")
		}
		if len(turn.ToolCalls) > limits.MaxCallsPerRound {
			return response, toolLimitError("calls_per_round")
		}
		if response.Calls+len(turn.ToolCalls) > limits.MaxCalls {
			return response, toolLimitError("calls")
		}

		calls := cloneToolCalls(turn.ToolCalls)
		messages = append(messages, Message{Role: "assistant", Content: turn.Content, ToolCalls: calls})
		for _, call := range calls {
			toolStart := time.Now()
			result, err := req.Tools.Execute(ctx, call, limits)
			toolTime += time.Since(toolStart)
			if err != nil {
				return response, err
			}
			response.ToolResults = append(response.ToolResults, result)
			content, err := json.Marshal(result)
			if err != nil {
				return response, fmt.Errorf("intelligence: encode tool result: %w", err)
			}
			messages = append(messages, Message{Role: "tool", Content: string(content), ToolCallID: call.ID})
		}
		response.Rounds++
		response.Calls += len(calls)
	}
}

// reasoningTurn runs one reasoning round. When locked is nil (no round has yet
// succeeded and no tool has run) it tries the cast's candidate routes in order,
// falling over on a failed call, and returns the route that answered so the
// caller can lock it. When locked is set it uses only that route.
func (in *Intelligence) reasoningTurn(ctx context.Context, candidates []Route, locked *Route, req ReasoningRequest) (ReasoningResponse, Route, error) {
	if locked != nil {
		req.Model, req.Effort = locked.Model, locked.Effort
		resp, err := in.providers[locked.Provider].Reasoning(ctx, req)
		return resp, *locked, err
	}
	var lastErr error
	for _, r := range candidates {
		req.Model, req.Effort = r.Model, r.Effort
		resp, err := in.providers[r.Provider].Reasoning(ctx, req)
		if err != nil {
			lastErr = err
			if shouldFallover(err) {
				continue
			}
			return ReasoningResponse{}, Route{}, err
		}
		return resp, r, nil
	}
	return ReasoningResponse{}, Route{}, lastErr
}

func toolLimitError(limit string) error {
	return fmt.Errorf("%w: %s", ErrToolLimitExceeded, limit)
}

func addUsage(left, right Usage) Usage {
	return Usage{
		PromptTokens:     left.PromptTokens + right.PromptTokens,
		CompletionTokens: left.CompletionTokens + right.CompletionTokens,
		ReasoningTokens:  left.ReasoningTokens + right.ReasoningTokens,
		TotalTokens:      left.TotalTokens + right.TotalTokens,
		CostUSD:          left.CostUSD + right.CostUSD,
		Requests:         left.Requests + right.Requests,
	}
}

func usageTokens(usage Usage) int {
	if usage.TotalTokens > 0 {
		return usage.TotalTokens
	}
	return usage.PromptTokens + usage.CompletionTokens
}

func cloneMessages(messages []Message) []Message {
	cloned := make([]Message, len(messages))
	for i, message := range messages {
		cloned[i] = message
		cloned[i].ToolCalls = cloneToolCalls(message.ToolCalls)
	}
	return cloned
}

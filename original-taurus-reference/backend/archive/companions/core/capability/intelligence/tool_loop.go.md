# tool_loop.go

`tool_loop.go` owns the bounded Reasoning continuation: call the provider, resolve only predefined tools, append normalized tool-result messages, and call the provider again until it supplies a final assistant turn or a hard limit/cancellation stops the request. Its plain and structured entry points share the same continuation and limits.

## One telemetry event for the whole loop

The loop reports a single `CallEvent` covering all its rounds, not one per round.
The loop is the unit a caller waited on and paid for, and its `Rounds` and
`Calls` counts only mean anything as totals — a per-round event would report
`rounds: 1` five times and lose the fact that matters.

It is recorded through a **deferred** closure with a named error return, because
this function has many exits and the interesting ones are the early ones: a
limit trip (`rounds`, `calls`, `total_tokens`) and a final answer that would not
parse are precisely the outcomes worth measuring. Reporting at each `return`
would work until someone added an exit and forgot; deferring makes that
impossible by construction.

The event carries the **locked** route rather than the cast's primary. Once a
route has answered, every later round uses that same route — so the locked route
is the model that actually did the work. If the loop failed before any route
answered, `locked` is nil and the event carries no model, which is itself
accurate: nothing served it.

What this exposes, measured on a live `live-document` run: one Action loop took
**23.0s and 20,508 tokens over 5 rounds and 10 tool calls** — more than every
other call in the run combined, and **92% of its tokens were prompt tokens**,
because a continuation loop re-sends its history every round. Round count, not
output length, is the cost driver. None of that was visible before.

### The event splits model time from our own time

A `toolTime` accumulator wraps each `Tools.Execute` call, and the total rides out
on the event as `ToolDuration` beside the loop's `Duration`.

The split exists because the total alone is unattributable. A loop that took
thirty seconds because the model thought and a loop that took thirty seconds
because a handler was slow are the same number from the outside and demand
opposite responses. Accumulating rather than timing each call separately is
deliberate: what a reader wants is "how much of this run was ours", and per-call
handler latencies are noise at this granularity.

Measured across the suites the answer is consistently *almost none* — hundredths
of a second of tool time against tens of seconds of model wait. That is a useful
negative result: it says the way to make a loop cheaper is fewer rounds, not
faster handlers.

## Code breakdown

### Bounded plain and structured Reasoning continuation

```go
package intelligence

import (
	"context"
	"encoding/json"
	"fmt"
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
func (in *Intelligence) reasonWithTools(ctx context.Context, req ToolRequest, schema json.RawMessage) (ToolResponse, error) {
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
		TotalTokens:      left.TotalTokens + right.TotalTokens,
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
```

Inference deliberately has no equivalent loop. `ReasonWithToolsJSON` sends one schema on every provider turn and returns validated JSON only after the final response carries no more tool calls.

### The loop's event carries the task that caused it

The deferred event reads `subjectFrom(ctx)`, so a tool loop is charged to the
task, chat or block that started it. This matters most here: a loop is the single
most expensive call the system makes, and attributing it is what turns "the suite
cost $0.02" into "this task cost 27.2s and 35,913 tokens over 8 rounds".

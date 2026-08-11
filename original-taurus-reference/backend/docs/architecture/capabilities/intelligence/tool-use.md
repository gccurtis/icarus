# Intelligence tool use

Intelligence tool use is a small, application-contained Reasoning loop. The
application supplies a fixed list of descriptors and already-written handler
functions for one call. A model may request one of those descriptors; it cannot
create a tool, discover an external tool, select a Project, read a host file,
run a command, open a network connection, or receive a capability that was not
already supplied by the application.

This implementation has three deliberately narrow pieces:

1. the provider-neutral Intelligence protocol;
2. an immutable ToolSet of predefined descriptor/handler pairs; and
3. one Project-bound read-only Knowledge search binding.

The [agent](../agents/README.md) capability is the production caller: its Plan and
Action tasks run this loop, composing the Knowledge search binding with task-local
and (in Action mode) document tools. Ask is not a caller yet — its retrieval and
context assembly remain a separate, still-unrouted consumer slice.

## The actual contract

~~~text
ToolDefinition {
    name
    version
    description
    input_schema
    output_schema
}

ToolBinding {
    definition
    private handler(ctx, raw_json_arguments)
}

ToolCall {
    id
    name
    version
    arguments
}

ToolResult {
    call_id
    name
    version
    ok
    output | error
}

ToolRequest {
    cast
    messages
    fixed ToolSet
    bounded limits
}

ToolResponse {
    final text | validated JSON
    complete normalized messages
    tool results
    aggregate usage
    rounds
    calls
}
~~~

ToolDefinition is model-visible data. ToolHandler is an in-process Go function
and is never serialized, configured at runtime, or provided by a user.
NewToolSet is the only construction path: it rejects duplicate name/version
pairs, missing handlers, and malformed descriptor schemas, then keeps its
handler map private. There is intentionally no registry interface and no
registration endpoint.

The schemas describe the public contract for a provider and the handler. The
current core validates that each schema is a JSON object and that call arguments
and successful outputs are valid JSON; it does not yet include a general JSON
Schema evaluator. The owning handler therefore performs its exact input
validation. Knowledge search, for example, rejects unknown fields as well as
invalid query and topK values.

## Provider boundary

The one-shot provider interface has separate operations:

~~~go
Inference(context.Context, InferenceRequest) (InferenceResponse, error)
Reasoning(context.Context, ReasoningRequest) (ReasoningResponse, error)
Embed(context.Context, EmbeddingRequest) (EmbeddingResponse, error)
~~~

Inference is message-only in this increment. Reasoning carries the fixed
descriptor list and can return neutral ToolCall values. This removes the old
generic Chat name: a future conversational Chat capability is a distinct
contract, not another name for one-off inference or reasoning.

The OpenRouter adapter translates descriptors to native function tools. It uses
request-local provider-safe names such as tool_1, stores the mapping only for
that request, and includes the stable name@version in the function description.
Returned wire names are mapped back before the Intelligence loop sees them. The
temporary name can therefore never replace or broaden the application contract.

## Structured final results

`ReasonWithToolsJSON` is the structured counterpart to `ReasonWithTools`, just
as `ReasonJSON` is the counterpart to one-shot `Reason`. It accepts the final
response schema separately from `ToolRequest`, sends that same schema on every
provider continuation, and validates that the terminal assistant content is
JSON before returning it in `ToolResponse.JSON`. A structured tool call never
falls back to free text.

This is the boundary an Ask caller needs for typed answer fields and citations:
the tool loop remains responsible only for model/tool continuation, while Ask
owns the response schema and validates any citation references against the
retrieval results it supplied or received through its fixed tools.

## Runtime flow

~~~text
caller resolves current Project and scope
  -> application code builds bindings for that scope
  -> NewToolSet(fixed bindings)
  -> Intelligence.ReasonWithTools or ReasonWithToolsJSON
  -> provider Reasoning call with descriptor copies
  -> final assistant turn
      -> return ToolResponse
    or returned ToolCalls
      -> append assistant tool-call turn
      -> ToolSet.Execute each call
      -> append normalized tool-result turns
      -> next provider Reasoning call
~~~

The loop sends the same fixed descriptor list on every Reasoning call. A tool
call is looked up by its exact name and version; there is no fallback or
name-based guessing. An unknown or unsupported version produces the structured
unknown_tool result and no handler runs. Invalid JSON, oversized arguments,
oversized results, invalid handler output, and handler-declared argument errors
also become structured tool results. A missing provider call ID cannot be
returned as a valid tool-role message, so it aborts the request before any
handler runs.

A handler may return ToolError for a safe model-visible rejection. Other handler
errors are reduced to tool_failed, so internal details do not become prompt
context. Cancellation always ends the loop and prevents later provider or
handler calls.

## Limits

The current hard ceilings are compiled into Intelligence:

| Limit | Ceiling |
| --- | ---: |
| tool-execution rounds | 8 |
| calls in one round | 8 |
| total calls | 32 |
| argument bytes per call | 64 KiB |
| successful result bytes per call | 128 KiB |
| aggregate provider tokens | 128 Ki tokens |

A caller may provide lower positive values in ToolLimits; zero means the
ceiling and a larger value is clamped to the ceiling. The ceilings are private
package state and DefaultToolLimits returns a copy, so a caller cannot mutate
the global envelope. Context cancellation/deadlines supply the wall-clock
bound. Provider usage is accumulated across every Reasoning call and the loop
stops before executing a returned tool call when the token ceiling has already
been crossed.

Cost budgeting is not implemented yet because the current provider-neutral
usage contract has tokens, not a provider/model price table. A frozen deployment
configuration can later choose tighter limits and provider routes, but it will
select and bound compiled application tools; it will not define handler code or
grant scope.

## Project-bound Knowledge search

Knowledge supplies the first real binding:

~~~go
tools, err := intelligence.NewToolSet(knowledge.SearchTool(projectID))
~~~

SearchTool(projectID) closes over the Project chosen by the surrounding
application service. Its public arguments are only query and optional topK. It
refuses an empty Project binding, unknown fields including a supplied projectId,
an empty or oversized query, and out-of-range topK. The handler calls
Knowledge.Retrieve with the captured Project and returns cited regions
containing source type/ID, byte range, relevance, text, and block references.
It does not return a local source key, raw upload path, database handle, or
Project identifier.

This is the model for future application tools: the owning capability produces
a normal, narrow handler closure for the already-resolved scope. Intelligence
does not route by Project ID and a model never selects a Project through an
argument.

## What is intentionally not here

- Ask integration, prompt construction, automatic initial retrieval, citation
  validation, and user interface context;
- dynamic tool registration, package discovery, host tools, shell execution,
  filesystem access, arbitrary network access, or external tool search;
- inference tool use;
- document reads, Formula evaluation, mutations, Action, Plan, and Agent
  authority;
- streaming, parallel execution, retries, generic JSON Schema evaluation,
  output truncation, cost pricing, and a live provider suite.

Future work adds only predefined bindings and consumers around this boundary.
It does not turn model output into authority or a general system tool runner.

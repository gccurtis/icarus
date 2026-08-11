# Intelligence tool use: concrete architecture

This document follows the implementation that now exists. It answers the
practical questions: where a tool is defined, what reaches a model, how a
returned request reaches a function, and where Project isolation lives.

The answer is intentionally simpler than a general Agent ToolBroker: the
application predefines ordinary functions, selects a fixed subset for one
Reasoning request, and dispatches only against that subset. There is no runtime
registry, no cross-Project broker, and no system-level tool surface.

## Ownership and packages

~~~text
core/capability/intelligence/
  provider.go       neutral Inference, Reasoning, Embedding contracts
  intelligence.go   cast routing and one-shot operations
  tools.go          fixed definitions, bindings, limits, exact dispatch
  tool_loop.go      bounded Reasoning continuation

core/integration/intelligence/openrouter/
  openrouter.go     OpenRouter function-tool and message translation

core/capability/knowledge/
  tool_search.go    current-Project Knowledge search binding
~~~

Intelligence owns the protocol and the bounded continuation. It does not know
about Knowledge, Documents, storage, users, or Project records. A domain owns
the operation its handler performs. The application service that has already
resolved the current Project constructs the domain binding for that Project.

There is no toolbroker package in this implementation. A separate Agent
execution broker may later be appropriate for Action and Plan authority, but it
would be a different capability from the low-risk, read-only Intelligence loop
built here.

## Definition versus handler

A tool has one public descriptor and one private function:

~~~go
type ToolDefinition struct {
    Name         string
    Version      string
    Description  string
    InputSchema  json.RawMessage
    OutputSchema json.RawMessage
}

type ToolHandler func(context.Context, json.RawMessage) (json.RawMessage, error)

type ToolBinding struct {
    Definition ToolDefinition
    Handler    ToolHandler
}
~~~

The model receives a copy of ToolDefinition; it never receives the handler, a
registry, a database, a service locator, or another capability. A binding is
created directly in Go by the capability that owns the operation. For a
scope-sensitive operation, the handler closure captures its scope:

~~~go
func (k *Knowledge) SearchTool(projectID string) intelligence.ToolBinding {
    return intelligence.ToolBinding{
        Definition: /* knowledge.search@v1 descriptor */,
        Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
            return k.searchTool(ctx, projectID, raw)
        },
    }
}
~~~

This is where the Project binding lives. projectID comes from the outer
authorized application request, not the model. The handler input schema has no
Project selection field. Even a malformed model argument containing projectId is
rejected by Knowledge strict decoding rather than changing scope.

## Construction and visibility

Application code constructs the only set that can execute for a request:

~~~go
tools, err := intelligence.NewToolSet(
    knowledge.SearchTool(projectID),
)
~~~

At construction, NewToolSet validates the descriptor shape and builds an
unexported exact map keyed by name and version. The ToolSet has only these public
operations:

~~~go
Definitions() []ToolDefinition
Empty() bool
Execute(context.Context, ToolCall, ToolLimits) (ToolResult, error)
~~~

It has no Register, Remove, Find, or discover-all-tools operation. The returned
definition slice and raw schemas are cloned, so a caller cannot mutate the
ToolSet visible descriptors after construction. Handler functions remain private
inside the set.

The current code creates a ToolSet per scoped operation. That is not dynamic
registration: the descriptor and handler implementation are compiled
application code; the only dynamic value is the scope closed over by the
already-authorized request.

## Reasoning request and response

A caller invokes:

~~~go
response, err := intel.ReasonWithTools(ctx, intelligence.ToolRequest{
    Cast:     cast,
    Messages: messages,
    Tools:    tools,
    Limits:   limits,
})
~~~

When the caller needs a typed final result, it instead supplies an output
schema to `ReasonWithToolsJSON`. The schema is not part of the model-controlled
tool request; Intelligence copies it into every provider `ReasoningRequest` and
returns validated terminal content in `ToolResponse.JSON` rather than `Text`.
The plain and structured paths have the same tool set, limits, history, and
dispatch behavior.

The service resolves the reasoning Cast to a configured provider and model. It
sends the provider a ReasoningRequest with cloned messages and cloned visible
descriptors. A provider response is either:

~~~text
final:
  { content, no tool calls, usage }

continuation:
  { assistant content, ToolCall[], usage }
~~~

A ToolCall carries an opaque provider call ID plus the stable application
name/version and raw JSON arguments. The model cannot supply a Go function
reference or a capability owner.

## Exact dispatch

For each returned call, the loop does this, in order:

1. Check context cancellation.
2. Check round, per-round call, aggregate call, and aggregate token limits.
3. Append the assistant tool-call message to the neutral history.
4. Look up the exact name/version in the unexported ToolSet map.
5. Check the raw argument byte ceiling and JSON validity.
6. Invoke only the matching predefined handler.
7. Check handler output byte ceiling and JSON validity.
8. Wrap either output or a safe ToolError in ToolResult.
9. Marshal that result as one tool-role message tied to the provider call ID.
10. Send the accumulated history, the same descriptor list, and the same final
    output schema when present to the next Reasoning call.

A missing call ID stops before step 3 because the provider protocol cannot
associate a tool result with it. An unknown name/version never reaches a
handler; it produces unknown_tool. ToolError is the deliberate safe-error
channel for handler validation and scope rejection. An ordinary Go error becomes
the generic tool_failed result.

The loop final response appends the final assistant message and returns the
entire normalized message history, the tool results, aggregate provider usage,
and round/call counters. Plain calls return `Text`; structured calls validate
the terminal content as JSON and return `JSON`. A context cancellation, invalid
structured terminal response, or exhausted limit returns an error and prevents
any later call.

## Provider translation

The neutral provider interface separates message-only Inference from tool-aware
Reasoning:

~~~go
type Provider interface {
    Inference(context.Context, InferenceRequest) (InferenceResponse, error)
    Reasoning(context.Context, ReasoningRequest) (ReasoningResponse, error)
    Embed(context.Context, EmbeddingRequest) (EmbeddingResponse, error)
}
~~~

OpenRouter completion API represents tools as native functions. The adapter
assigns a temporary request-local name such as tool_1 for each descriptor and
sends the functions alongside `response_format` whenever a structured
`ReasoningRequest` carries a schema:

~~~json
{
  "type": "function",
  "function": {
    "name": "tool_1",
    "description": "Application tool: knowledge.search@v1",
    "parameters": { "type": "object" }
  }
}
~~~

The adapter keeps both directions of the mapping in memory while satisfying the
one HTTP call. It uses the same map to encode historical assistant tool calls
for the continuation request, then maps returned wire names back to
knowledge.search and v1. An unrecognized provider name is deliberately left as
an unknown core tool call; it cannot collide with a handler.

This allows each provider to impose its own function-name restrictions without
changing the stable application identity or dispatch semantics.

## Knowledge search in detail

knowledge.search@v1 accepts an object with query and optional topK. The handler:

1. rejects an unbound Project;
2. strictly decodes only those two fields;
3. bounds query bytes and topK;
4. calls Knowledge.Retrieve with capturedProjectID, query, and topK; and
5. emits cited regions as JSON.

Each region names the original source type and ID, start/end offsets, relevance,
text, and block references. Knowledge own retrieval bounds the returned regions;
Intelligence adds a separate byte ceiling for the serialized tool output. The
handler neither accepts nor exposes a Project ID.

## Limits and configuration

The source has private hard ceilings of 8 rounds, 8 calls per round, 32 calls,
64 KiB arguments, 128 KiB successful results, and 128 Ki aggregate tokens.
ToolLimits effective chooses the lower of a caller positive request and the hard
ceiling. Zero asks for the ceiling. DefaultToolLimits returns a value copy, not
mutable shared configuration.

This is the current code-level protection. A later frozen backend/Docker
configuration can choose lower per-deployment limits and which compiled
bindings a service includes. It cannot carry arbitrary functions, mutate a
descriptor schema, select a Project from a tool argument, or permit host access.
Cost limits wait until there is a stable pricing source; deadlines use the caller
context.

## Sequence diagram

~~~text
authorized service                    Intelligence                  provider              Knowledge
       |                                    |                           |                     |
       | resolve Project                     |                           |                     |
       | SearchTool(Project)                 |                           |                     |
       | NewToolSet(binding)                 |                           |                     |
       | ReasonWithTools ------------------->|                           |                     |
       |                                    | Reasoning(definition) --->|                     |
       |                                    |<-- ToolCall(name@version)-|                     |
       |                                    | exact map lookup          |                     |
       |                                    | handler(ctx,args) ----------------------------->|
       |                                    |<------------------------- cited JSON ------------|
       |                                    | Reasoning(history+result)->|                     |
       |                                    |<-- final text ------------|                     |
       |<-- ToolResponse -------------------|                           |                     |
~~~

The service Project resolution happens before tool construction and the
Knowledge call receives only the captured value. Nothing on the provider side
is able to move that boundary.

## Out of scope

Ask is not yet wired to ReasonWithTools; it will first perform its automatic
retrieval, assemble context, choose a fixed read-only ToolSet, and then use this
loop for optional follow-up retrieval. Inference remains tool-free.

Tool discovery, Documents, Formula, mutations, Action, Plan, Agent grants,
parallel calls, streaming, retries, full JSON Schema evaluation, result
truncation, provider cost tables, and live provider tests remain later,
independent increments.

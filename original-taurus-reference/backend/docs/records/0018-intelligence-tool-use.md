# 0018 — Intelligence tool use: fixed application bindings

This increment turns the Intelligence tool-use design into the first working,
read-only implementation. It deliberately proves the small application model:
fixed descriptors plus compiled handlers, selected for one already-scoped
Reasoning call. It does not wire Ask, create an Agent broker, or create a
general runtime tool registry.

## `core/capability/intelligence/provider.go`

### Replace the generic one-shot Chat seam

~~~go
type Provider interface {
    Name() string
    Inference(context.Context, InferenceRequest) (InferenceResponse, error)
    Reasoning(context.Context, ReasoningRequest) (ReasoningResponse, error)
    Embed(context.Context, EmbeddingRequest) (EmbeddingResponse, error)
}
~~~

The provider boundary now says what each call is for. Inference stays
message-only; Reasoning has a neutral descriptor list and can return neutral
tool calls. This is the deferred naming correction from the design work:
conversational Chat is not silently used as the generic name for a one-shot
model request.

## `core/capability/intelligence/intelligence.go`

### Route the explicit provider modes

The one-shot Reason and Infer methods now dispatch to their corresponding
provider methods. A plain Reason call rejects an unexpected provider tool call,
so only the explicit bounded loop can satisfy tools. This retains exact cast
routing while preventing an ordinary endpoint from acquiring a hidden
continuation path.

## `core/capability/intelligence/tools.go`

### Add immutable predefined tool dispatch

~~~go
tools, err := intelligence.NewToolSet(
    predefinedBinding,
)
~~~

ToolSet validates fixed descriptor/handler pairs once and keeps its exact
name/version map private. There is intentionally no registration API. The
dispatcher accepts valid bounded JSON only, invokes the single matching handler,
and turns rejection or ordinary failure into a safe ToolResult. A handler can
use ToolError for an intended model-visible argument or scope failure.

### Add hard, non-escalatable limits

The implementation caps rounds, calls, arguments, results, and aggregate
provider tokens. A caller can tighten the request but a value above the private
ceiling is clamped. Returning DefaultToolLimits as a value copy avoids mutable
global limit state.

## `core/capability/intelligence/tool_loop.go`

### Implement the bounded Reasoning continuation

~~~text
provider Reasoning
  -> final assistant message
  -> or exact ToolSet dispatch
  -> normalized tool-role result
  -> next provider Reasoning call
~~~

ReasonWithTools accumulates usage, messages, results, rounds, and calls. It
uses the same descriptor list on every provider call, stops on cancellation or
an exhausted limit, and appends the final assistant message before returning.
Inference has no equivalent loop.

## `core/capability/intelligence/intelligence_test.go`

### Prove loop behavior with a deterministic provider

Tests cover separate model routing, structured one-shot output, a tool
continuation that produces a final answer, exact-version non-execution, argument
and result byte ceilings, round limits, and cancellation. These tests prove core
control flow without a provider credential.

## `core/integration/intelligence/openrouter/openrouter.go`

### Translate neutral tools at the provider edge

OpenRouter converts each visible descriptor to a request-local native function
name and records both mapping directions while satisfying a completion request.
The stable application name/version remains in the description and is restored
before a ToolCall enters core dispatch. This keeps provider naming constraints
out of application contracts.

## `core/integration/intelligence/openrouter/openrouter_test.go`

### Verify inference, reasoning, and native tool payloads

Adapter tests assert the plain and structured inference requests, descriptor
translation, returned function-call remapping, tool-result history encoding,
embeddings, unconfigured credentials, and sanitized provider errors.

## `core/capability/knowledge/tool_search.go`

### Bind Knowledge search to the current Project

~~~go
tools, err := intelligence.NewToolSet(knowledge.SearchTool(projectID))
~~~

Knowledge is the first real handler owner. SearchTool captures the already
resolved Project identifier in its closure, strictly admits only query and
topK, and calls normal Knowledge retrieval with that captured scope. It returns
cited regions rather than storage-local identities or raw sources. The model
cannot select another Project through arguments.

## `core/capability/knowledge/tool_search_test.go`

### Verify Project isolation at the handler boundary

The test adds similarly searchable material to two Projects, attempts to supply
another projectId in model arguments, and confirms that the binding rejects the
argument and retrieves only from the Project captured by its closure.

## `core/capability/intelligence/provider.go.md`, `intelligence.go.md`, `tools.go.md`, and `tool_loop.go.md`

### Add and synchronize Intelligence companions

Each companion reproduces its current Go source verbatim and explains the
provider protocol, cast-routing boundary, fixed descriptor/handler map, and
bounded continuation separately from this historical rationale.

## `core/integration/intelligence/openrouter/openrouter.go.md`

### Synchronize the provider adapter companion

The companion now reflects the explicit Inference/Reasoning methods and the
request-local OpenRouter tool-name mapping.

## `core/capability/knowledge/tool_search.go.md`

### Add the Knowledge search companion

The companion documents the captured-Project binding, strict public arguments,
and cited output shape as the code stands.

## `docs/architecture/capabilities/intelligence/tool-use.md`

### Update the capability boundary to the implemented model

The capability document now distinguishes what works today from later design
work: exact ToolSet dispatch and Knowledge search exist; generic schema
evaluation, cost pricing, discovery, Ask integration, and external tools do
not.

## `docs/architecture/capabilities/intelligence/tool-use-architecture.md`

### Replace the stale broker architecture with the concrete runtime path

The detailed document now traces a scoped service through binding construction,
provider translation, exact dispatch, Knowledge retrieval, and continuation.
It explicitly records why Project scope is captured outside Intelligence and
why no runtime registry or cross-Project broker is needed for this increment.

## Follow-up — structured tool-loop results

### `core/capability/intelligence/tool_loop.go` and `intelligence_test.go`

Add `ReasonWithToolsJSON`, the structured counterpart to the plain tool loop.
It sends one schema on every Reasoning continuation, accepts only a JSON
terminal assistant result, and exposes it as `ToolResponse.JSON`. The tests
cover a tool continuation retaining its schema across both provider calls and a
malformed final result failing closed.

### `core/integration/intelligence/openrouter/openrouter_test.go`

Assert that the adapter sends OpenAI-compatible `response_format` at the same
time as its native function tools. The adapter already supported both fields;
this test makes that required combination explicit.

### Companion and architecture documentation

Update the tool-loop companion and Intelligence tool-use documents so Ask can
rely on one schema-preserving tool continuation for typed answer/citation output.

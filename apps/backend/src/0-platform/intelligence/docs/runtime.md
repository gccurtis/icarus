# Intelligence runtime

## Construction

[`createIntelligence`](../../../1-init/create/intelligence.ts) constructs one `OpenRouterProvider`, registers it by `name()` (`openrouter`), and creates one shared `Intelligence` with configuration and Logger. [`startBackend`](../../../1-init/startBackend.ts) injects that object into Knowledge and Derived Outputs.

At construction, `createRouteMap` builds separate inference and reasoning maps. Construction can fail for invalid tiers or duplicate normalized cast keys. A route may still reference an unregistered provider; that fails when selected, not at startup.

## `Intelligence` methods

| Method | Processing | Result | Side effects |
| --- | --- | --- | --- |
| `infer(signal, req)` | Resolve inference route, clone messages, call provider `infer` | `TextResult` | External call; debug telemetry |
| `inferStructured(signal, req, schema)` | Same, carrying schema; JSON-parse content | `StructuredResult` | External call; debug telemetry before parsing return |
| `reason(signal, req)` | Resolve reasoning route and call provider; reject returned tool calls | `TextResult` | External call; debug telemetry on success |
| `reasonStructured(signal, req, schema)` | Reason with schema; reject tool calls; JSON-parse content | `StructuredResult` | External call; debug telemetry before parsing return |
| `reasonWithTools(signal, req, tools, maxRounds?)` | Run bounded reasoning/tool loop | Final text, transcript, tool results, counts, aggregate usage | One or more external calls and local tool side effects |
| `reasonWithToolsStructured(...)` | Run same loop with schema and JSON-parse final text | Structured value plus loop metadata | Same as tool loop |
| `embed(signal, req)` | Use configured embedding provider/model; shallow-copy inputs | Vectors with provider/model/usage | External call; debug telemetry |

The default tool limit is eight rounds. `maxRounds` is not validated: zero or a negative number immediately reaches the limit error; non-integer positive values effectively allow rounds while the integer counter remains lower.

## Internal method and helper map

| Function | Role |
| --- | --- |
| `usageZero` | Starts aggregate tool-loop accounting |
| `addUsage` | Adds round usage and optional costs |
| `telemetry` | Builds safe duration/routing/usage log metadata |
| `normalizeCast` / `normalizeRouteCast` | Canonicalize purpose while retaining tiers |
| `castKey` | Produces exact map key |
| `ensureTier` | Runtime tier validation |
| `extractStructured` | `JSON.parse` with stable generic error |
| `cloneMessages` | Protects caller-owned top-level transcript objects from adapter mutation |
| `reasonWithToolsInternal` | Shared plain/structured loop |
| `resolveRoute` | Normalizes request, validates tiers, exact map lookup |
| `createRouteMap` | Normalizes configuration and rejects duplicate keys |
| `getProvider` | Looks up named adapter or throws |

## Tool execution

[`ToolSet`](../tools.ts) builds a name-to-handler map. `definitions()` returns new definition objects but retains the original nested `inputSchema` reference. `execute()` returns a failed result rather than throwing for unknown tools or handler failures.

Within one model round, `reasonWithToolsInternal`:

1. calls the provider with a clone of the current transcript and current definitions;
2. adds provider usage;
3. returns immediately if no tool calls were supplied;
4. increments round/call counters;
5. appends the assistant message and calls;
6. executes calls one at a time in provider order;
7. appends a JSON tool message for every result.

The `rounds` value counts rounds that contained tools, not the final model-only round. Provider usage includes the final round. If the loop exhausts, accumulated usage and tool results are not returned with the thrown error.

## OpenRouter adapter

| Method/helper | Responsibility |
| --- | --- |
| `infer` | POST chat completion without tools |
| `reason` | POST chat completion with optional tools |
| `embed` | POST embeddings and retain numeric vector elements |
| `chatCompletion` | Require a first choice and normalize message content/calls/usage |
| `postJson` | Check API key, combine caller cancellation with timeout, send authenticated JSON, redact failure body |
| `toWireMessages` | Translate internal transcript |
| `toWireTools` | Translate tool definitions |
| `schemaFormat` | Build strict provider response format |
| `parseUsage` | Normalize missing/partial usage to zeros |
| `parseToolCalls` | Decode valid calls and safe argument records |

`postJson` uses a local `AbortController`. The configured timeout and caller abort both abort the same fetch. Listener and timer cleanup occurs in `finally`. Non-2xx bodies are drained but never copied into the error or logs; status and an optional request ID are retained.

## Logging

Successful Intelligence operations emit a `debug` record through the injected Logger with component `intelligence`. Fields include operation, provider, model, duration, token counts, optional cost, and for selected operations input/tool counts. No prompt, response, schema, tool arguments, tool outputs, vector content, API key, or provider error body is logged here.

Provider and route failures are not logged inside Intelligence; they propagate to the calling job. Derived Outputs logs stage-aware failures, and startup logs construction failures. This makes the caller the error-translation boundary.

## Concurrency and state

Route maps, configuration, and provider registry are read-only after construction. Each call builds its own transcript, usage accumulator, timer, and abort controller, so the Intelligence orchestration has no per-call shared mutable state. Tool handlers may mutate capability state; concurrency guarantees therefore belong to the calling job and handler.

## Current implementation limits

- Only OpenRouter is constructed in production.
- There is no retry, backoff, rate limiter, circuit breaker, or provider fallback.
- There is no runtime JSON Schema validation after parsing.
- Embedding response cardinality/dimensions are not checked.
- Tool arguments are not validated by `ToolSet`.
- Tool-handler failures intentionally lose the original error detail.
- Successful provider calls are logged; failed calls are logged only by callers, if they do so.

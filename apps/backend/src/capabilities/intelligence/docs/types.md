# Intelligence types

The public types are split across [`types.ts`](../types.ts), [`provider.ts`](../provider.ts), and [`tools.ts`](../tools.ts). They are ordinary TypeScript interfaces; the Intelligence directory contains no runtime schema validator.

## Selection and configuration

| Type | Fields | Rules enforced by current runtime |
| --- | --- | --- |
| `IntelligenceTier` | `low \| medium \| high` | Runtime checks configured and requested `strength`/`speed`; TypeScript/config parsing checks normal input |
| `Cast` | `purpose`, `strength`, `speed` | Purpose is trimmed/lowercased with empty mapped to `general`; route lookup is exact |
| `CastRoute` | Cast fields plus `provider`, `model`, optional `effort` | Duplicate normalized keys fail construction; provider/model strings are otherwise passed through |
| `OpenRouterProviderConfig` | `apiKey`, `baseUrl`, `timeoutMs` | Empty key fails at call time; URL and positive timeout are expected from config parsing |
| `IntelligenceConfig` | provider config; inference/reasoning route arrays; embedding provider/model | Read by constructor; only route tier/duplicate validation happens inside `Intelligence` |

The equivalent backend configuration interfaces and parsing logic live in [`loadBackendConfig.ts`](../../../initialization/configuration.ts). They are structurally compatible rather than imported from this package.

## Messages

`MessageRole` is `system | user | assistant | tool`.

| `Message` field | Meaning |
| --- | --- |
| `role` | Provider-neutral transcript role |
| `content?` | Text content; the OpenRouter adapter sends an empty string when absent |
| `toolCalls?` | Assistant-requested calls: `id`, `name`, and argument record |
| `toolCallId?` | Associates a tool-role response with a prior call |

`cloneMessages` copies every message, tool-call object, and top-level arguments object before provider invocation. Nested values inside tool arguments are not deep-cloned.

## Public requests and results

| Type | Shape | Used by |
| --- | --- | --- |
| `InferRequest` | `{ cast, messages }` | `infer`, `inferStructured` |
| `ReasonRequest` | `{ cast, messages }` | all reasoning operations |
| `EmbedRequest` | `{ inputs: string[] }` | `embed` |
| `TextResult` | `{ text, usage }` | plain inference/reasoning |
| `StructuredResult` | `{ structured: unknown, usage }` | non-tool structured calls |
| `EmbedResult` | `{ vectors, provider, model, usage }` | embeddings |

Tool-loop return objects are declared inline in [`intelligence.ts`](../intelligence.ts), not as exported named types. Plain tool reasoning returns `text`; structured tool reasoning replaces it with `structured`. Both also return `messages`, `toolResults`, `rounds`, `calls`, and aggregate `usage`.

## Usage

`Usage` contains:

| Field | Meaning |
| --- | --- |
| `promptTokens` | Provider-reported prompt/input tokens |
| `completionTokens` | Provider-reported completion/output tokens |
| `totalTokens` | Provider-reported total |
| `reasoningTokens` | Provider-reported reasoning tokens, defaulting to zero in OpenRouter normalization |
| `costUsd?` | Optional provider-reported `cost`; omitted if unavailable |

Tool-loop accumulation sums every numeric field. `costUsd` remains absent only when every round omits it.

## Provider contract

| Type | Important fields |
| --- | --- |
| `ProviderInferenceRequest` | model, messages, optional effort/schema |
| `ProviderInferenceResponse` | content, usage |
| `ProviderReasoningRequest` | model, messages, optional effort/schema/tools |
| `ProviderReasoningResponse` | content, tool calls, usage |
| `ProviderEmbedRequest` | model, input strings |
| `ProviderEmbedResponse` | vectors, usage |
| `Provider` | `name`, `infer`, `reason`, `embed` |

Every provider operation accepts `AbortSignal | undefined`. Providers receive an already selected model and never see a `Cast`.

## Tool contract

| Type | Purpose |
| --- | --- |
| `ToolDefinition` | Provider-visible name, description, JSON-schema-like `inputSchema` |
| `ToolCall` | Provider-requested call ID, name, and decoded arguments |
| `ToolHandler` | `(args) => Promise<unknown>` local implementation |
| `ToolBinding` | Definition plus handler |
| `ToolResult` | Stable call/name, `ok`, and either output or generic error |
| `ToolExecutionResponse` | Exported result-shaped interface, but not used by `Intelligence` return annotations |

`ToolSet` rejects duplicate definition names. It does not validate handler arguments against `inputSchema`; handlers must validate their own input.

## OpenRouter wire representation

[`openrouter/provider.ts`](../openrouter/provider.ts) translates:

- messages to OpenAI-compatible `role`, `content`, `tool_calls`, and `tool_call_id` objects;
- definitions to `type: "function"` tools with `parameters`;
- schemas to strict `json_schema` response format named `structured_response`;
- effort to a `reasoning.effort` object;
- provider usage snake_case fields to `Usage`;
- stringified tool arguments to records, falling back to `{}` on invalid/non-object JSON.

Malformed tool-call elements, calls without ID/name, and nonnumeric embedding elements are silently omitted. A chat response with no usable first choice throws; missing textual content normalizes to an empty string.

## Persistence and wire exposure

Intelligence owns no SQL representation and no HTTP request/response types. Capability endpoints translate their own wire values into these in-process types. Provider request/response bodies remain private to the adapter.

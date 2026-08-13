# Intelligence documentation

## Status and authority

Intelligence is an implemented in-process platform runtime. It selects configured model routes, normalizes provider responses, runs bounded tool loops, and exposes embeddings. It does not register HTTP endpoints, create jobs, persist results, or validate capability-specific semantics.

These pages describe the code currently under [`capabilities/intelligence`](../). The older repository-wide [platform design page](../../../../../../docs/platform/intelligence.md) is useful background, but this package is authoritative where that page describes planned APIs or behavior not present in source.

## Documentation map

| Document | Question answered |
| --- | --- |
| [Concepts](concepts.md) | What problem does Intelligence solve, and where is its boundary? |
| [Types](types.md) | What requests, results, provider contracts, messages, and tool values exist? |
| [Runtime](runtime.md) | How are routes selected, providers called, tools executed, and telemetry emitted? |
| [Flows](flows.md) | Which startup paths, capability jobs, and concrete call chains use it? |
| [Invariants](invariants.md) | What can callers rely on, and what is deliberately not guaranteed? |

## Implementation map

| Code | Responsibility |
| --- | --- |
| [`intelligence.ts`](../intelligence.ts) | `Intelligence`, route maps, normalized calls, structured parsing, bounded tool loop, telemetry |
| [`types.ts`](../types.ts) | Cast, configuration, message, usage, request, and result types |
| [`provider.ts`](../provider.ts) | Provider-neutral adapter contract |
| [`tools.ts`](../tools.ts) | Tool definitions, bindings, results, and `ToolSet` |
| [`openrouter/provider.ts`](../openrouter/provider.ts) | OpenRouter wire translation, HTTP, timeout, response normalization |
| [`create/intelligence.ts`](../../../initialization/runtimes/intelligence.ts) | Production construction and provider registration |
| [`loadBackendConfig.ts`](../../../initialization/configuration.ts) | Configuration parsing and default route matrix |
| [`intelligence.yaml`](../../../../configuration/intelligence.yaml) | Committed provider, inference, reasoning, and embedding routes |
| [`create-runtime.ts`](../../../initialization/create-runtime.ts) | Process-level composition and injection |

## Public runtime surface

`Intelligence` exposes seven operations: `infer`, `inferStructured`, `reason`, `reasonStructured`, `reasonWithTools`, `reasonWithToolsStructured`, and `embed`. `ToolSet` exposes `definitions` and `execute`. The production provider is `OpenRouterProvider`.

Current production consumers are:

- Derived Outputs: planning through `reasonStructured`, synthesis through `reasonWithToolsStructured`.
- Knowledge: query and source-window embeddings through `IntelligenceEmbedder`.

No direct tests cover route selection, structured parsing, tool-loop accounting, or successful OpenRouter response normalization. [`runtime-wiring.test.ts`](../../../../test/capabilities/runtime-wiring.test.ts) covers the provider-error redaction rule. Derived Outputs exercises Intelligence through fakes rather than the concrete runtime.

## Reading order

Start with [Concepts](concepts.md), then use [Flows](flows.md) to locate the production call path. [Runtime](runtime.md) and [Types](types.md) are the code-level references. Use [Invariants](invariants.md) when changing configuration, providers, logging, tool behavior, or callers.

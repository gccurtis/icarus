# Intelligence invariants and guarantees

## Selection guarantees

| Preconditions | Guaranteed outcome |
| --- | --- |
| Configured routes have valid tiers and unique normalized keys | Construction produces deterministic, independent inference/reasoning maps |
| A request has valid tiers and an exact configured cast key | Exactly that route is selected |
| The selected provider name is registered | That provider receives the configured model and effort |
| Purpose is blank/whitespace | It is treated as `general` |
| Purpose differs only by case or surrounding whitespace | It resolves to the same key |

There is no route fallback. Missing routes/providers fail before any provider request.

## Call guarantees

- Caller message arrays and top-level message/tool-call/argument objects are not handed directly to providers.
- Plain `reason`/`reasonStructured` reject a response containing tool calls.
- Structured operations either return a JSON-decoded value or throw `Structured response was not valid JSON`.
- Embedding results identify the configured provider and model.
- Successful calls return provider-normalized usage.
- Tool-loop usage is the sum of all completed provider rounds.
- Tool loops stop on a provider response without calls or throw once the configured round ceiling is reached.
- Calls from one tool response execute serially and preserve response order.

## Tool guarantees

| Preconditions | Guaranteed outcome |
| --- | --- |
| Binding names are unique | `ToolSet` constructs successfully |
| Provider requests a registered name and handler resolves | Result has `ok: true` and preserves output |
| Name is unknown | Result has `tool_not_found`; loop continues |
| Handler throws/rejects | Result has generic `tool_failed`; loop continues |

Input-schema conformance, authorization, timeout, idempotency, and handler side-effect safety are not enforced by `ToolSet`.

## Cancellation and network safety

- OpenRouter calls are bounded by the configured timeout.
- A supplied abort signal is linked to the provider request.
- Timers and signal listeners are removed after completion/failure.
- Provider credentials remain in the Authorization header and are not returned.
- Non-success response bodies are never included in adapter diagnostics.
- Prompts, outputs, schemas, arguments, tool outputs, and embeddings are absent from Intelligence telemetry.

Base URL/protocol policy is configuration-owned; the adapter does not independently restrict hosts or redirects.

## Logging guarantees

Successful operations log duration, route identity, usage, optional cost, and bounded counts through Logger. Logging does not alter returned domain values. Failed operations do not have a guaranteed Intelligence-level log; the owning caller must log/translate them.

## Concurrency and persistence

Intelligence owns no SQL data, job queue, idempotency ledger, retry state, or global mutable call state. Concurrent calls share only read-only route/provider references. Provider implementations and local tool handlers must establish their own concurrency safety.

## Explicit non-guarantees

The current implementation does not guarantee:

- deterministic model output, factual correctness, or completeness;
- that parsed structured output conforms to the supplied JSON Schema;
- vector count, dimension, normalization, or finite numeric values;
- retries, fallback routes/providers, rate-limit handling, or circuit breaking;
- preservation of malformed provider tool calls/arguments;
- caller cancellation for Knowledge embeddings, because its adapter passes no signal;
- retention of partial tool-loop usage/results when the round limit throws;
- secrecy of capability-level error messages if a caller chooses to log them.

## Tests and change checklist

Current direct coverage is limited to OpenRouter failure-body redaction in `runtime-wiring.test.ts`. Before changing Intelligence, tests should pin:

- purpose normalization, exact route selection, duplicate/missing route behavior;
- successful plain and structured result normalization;
- invalid structured JSON;
- tool ordering, unknown/failed tools, usage aggregation, and round exhaustion;
- cancellation and timeout cleanup;
- malformed OpenRouter messages, calls, usage, and vectors;
- telemetry fields and sensitive-field exclusion.

When adding a route, ensure the capability purpose exactly matches configuration. When adding a provider, verify its errors cannot carry prompts, responses, credentials, or arbitrary provider bodies into shared logs.

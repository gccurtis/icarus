# intelligence

The process-wide OpenRouter transport and bounded tool-calling loop. It owns one
immutable provider provision (endpoint, model, limits, and credential) for the
life of the server process. Callers provide prompts and local tool handlers; the
object serializes those tools, executes requested calls, and returns the final
value, accounting, and a safe call trace.

Callers may request a strict JSON Schema response. The same schema is sent on
every provider turn, and the final JSON is accepted only after the caller's
application parser validates it. Plain text remains the default when no output
contract is supplied.

No prompt, tool result, provider body, or credential is logged here. HTTP
failures are reduced to a status, timeouts to a stable message, and malformed
responses to a stable contract error.

## Ownership Boundary

One server-model instance owns the OpenRouter endpoint, credential, transport,
and loop limits. Capabilities provide prompts and request-scoped tool handlers;
they never receive the underlying credential or transport.

## Lifetime

The immutable port is constructed with the server graph and lives until that
graph closes. Each completion owns its messages, tool trace, timeout, and usage;
none are retained by the model after the call returns. A caller signal crosses
both provider requests and local tool boundaries; cancellation is propagated
as cancellation rather than serialized as an ordinary tool failure.

## Invariants

- Every tool call is admitted against a caller-supplied name and input schema.
- Ordinary tool failures return bounded safe errors rather than secrets or raw
  bodies; caller cancellation propagates out of the loop.
- The configured round and timeout bounds terminate incomplete runs.
- Structured output is returned only after the caller's parser accepts it.

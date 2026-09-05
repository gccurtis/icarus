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

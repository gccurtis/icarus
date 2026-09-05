# intelligence

The process-wide OpenRouter transport and bounded tool-calling loop. It owns one
immutable provider provision (endpoint, model, limits, and credential) for the
life of the server process. Callers provide prompts and local tool handlers; the
object serializes those tools, executes requested calls, and returns only the
final text, accounting, and a safe call trace.

No prompt, tool result, provider body, or credential is logged here. HTTP
failures are reduced to a status, timeouts to a stable message, and malformed
responses to a stable contract error.

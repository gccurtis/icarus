# Model resilience: strict-schema fix, error surfacing, and cast fallback chains

A durable agent Plan task was failing with an opaque `openrouter: 400 Bad
Request: Provider returned error`. Digging in produced three related changes:
a root-cause fix, better diagnostics, and a general fallback mechanism so a
single model/provider hiccup no longer fails a call.

## Root cause — a strict-schema bug (fixed in `be845d6`)

The Plan output schema's `risks` item declared a `mitigation` property but listed
only `description` in `required`. OpenAI/Azure **strict structured outputs** mode
requires that *every* property appear in `required`, so the request was rejected —
deterministically, not intermittently. (The Action schema was already strict-clean,
which is why only Plan failed.) Fixed by requiring `mitigation` and making it
nullable (`"type": ["string","null"]`), preserving its optional semantics.
Verified against `openai/gpt-4o-mini` and end-to-end (the live notifications
dev-test now completes with a success toast).

## Diagnostics — surface the upstream error (`be845d6`)

OpenRouter proxies to an upstream provider and returns a generic "Provider
returned error" at the top level; the real message sits in
`error.metadata.raw` (a JSON-encoded upstream body). `openRouterError` now
appends the upstream provider name and its actual message, so a failure is
diagnosable from the log alone.

## Resilience — ordered fallback chains per cast (this change)

`Intelligence` now maps a cast to an **ordered list of candidate routes**
(`map[Kind]map[Cast][]Route`) instead of a single route. The first is the primary;
each later one is a fallback tried, in order, when an earlier candidate's provider
call fails — every real failure (bad request, rate limit, outage) falls over; only
a client-cancelled or timed-out context does not (a fallback would just race the
same deadline). If all candidates fail, the last error is returned.

- Single-shot calls (`Reason`/`Infer` and their `…JSON` variants) and `Embed`
  iterate candidates directly.
- The `ReasonWithTools` loop falls over **only on the first round**, before any
  tool has executed; once a route answers, the loop locks to it — a
  provider-specific conversation cannot be resumed elsewhere, and re-running after
  tools ran would repeat their side effects.

**Configuration is unchanged and backward compatible:** `castRoutes` already maps
the config cast list to routes in order, so a fallback is expressed simply by
listing a cast tuple `(purpose, strength, speed, cost)` more than once with
different provider/model rows. A tuple listed once behaves exactly as before.
`etc/config.yaml` documents this and ships one live example — a small reliable
backup (`openai/gpt-4o-mini`) for the default agent tier.

## Tests

- Unit (`core/capability/intelligence`): a failed primary falls over to the backup
  (single-shot and embedding); a cancelled context does **not** fall over; all
  candidates failing returns the last error; the tool loop falls over on its first
  round.
- The `mitigation` schema fix is covered end-to-end by the live
  `dev-test/notifications` suite completing a real Plan task.

## Settled

- Strict schemas: every object property must be in `required`; optional fields are
  nullable. ✓
- Upstream provider errors are surfaced, not swallowed. ✓
- Fallback is config-driven, ordered, and backward compatible. ✓
- Tool-loop fallback never repeats tool side effects. ✓

# 0153 — Patience is a budget, and a slow provider is not a lost caller

Phase 2 of the resilient-ingest design
([spec](../superpowers/specs/2026-07-29-resilient-ingest-design.md)). Three defects
in how the embedding path answered a provider that would not serve it.

## Seven seconds of patience

`intelligence.embedding.max_attempts: 4` with `backoff: "1s"` doubling gives
`1 + 2 + 4` — **seven seconds** — against rate limits enforced over windows measured
in *minutes*. The number looked deliberate and bounded nothing anyone had chosen:
an attempt count bounds the wait only as a side effect of the backoff curve, so the
arithmetic that mattered was never stated anywhere.

`MaxAttempts` is now `MaxWait: "90s"` — total time one chunk may spend waiting.
Ninety seconds says the thing directly, and stays true if the backoff curve ever
changes.

The attempt count had also been doing a second job: bounding the *hiccup* retry, the
immediate re-ask after a short or empty vector list. That is now
`embedHiccupRetries = 1`, a constant rather than configuration, because it is not a
budget. A provider that answers wrongly twice with no rate limit and no timeout will
not be fixed by a third ask, and each ask costs a full embedding request. The loop
now separates the two cases by **what the failure is asking for**: a hiccup is
re-asked at once and waits not at all; a refusal is waited out.

## Retry-After was thrown away

A 429 was wrapped as a bare `ErrRateLimited`, discarding the `Retry-After` header —
so the capability guessed with its own backoff while the provider had already said
when its window resets. Guessing *short* is the bad direction: it walks straight
back into the limit.

`RateLimited` is now a typed error carrying `RetryAfter`, unwrapping to
`ErrRateLimited` so every existing `errors.Is` check is untouched. `parseRetryAfter`
takes both forms RFC 9110 allows (delay-seconds and HTTP-date) and yields zero for
anything unparseable, non-positive, or already past — read as "the provider named no
delay", which is the safe direction: a malformed header must never become a wait of
unknown length.

**One case inverts the rule.** A `Retry-After` longer than the remaining budget is
not slept. Honouring an hour-long delay inside a request is exactly the unbounded
wait the budget exists to prevent, so the loop gives up at once and surfaces the rate
limit for something above to act on. Both directions have a test.

## A slow provider looked exactly like a caller who left

The worst of the three, because it made things worse precisely when they were
already bad.

`http.Client{Timeout}` produces an error satisfying
`errors.Is(err, context.DeadlineExceeded)` — the same shape as the caller's context
expiring. `shouldFallover` therefore read a slow provider as "the caller gave up"
and returned false, so the embed **aborted with no retry and no fallover**, at
exactly the moment load was highest and a busy provider most needed asking again.

The fix has two halves in two layers, and it has to:

- The **adapter** is the only place that can tell them apart, because it is the only
  place holding both the caller's context and the deadline it configured. When
  `client.Do` fails it asks `ctx.Err()`; if the caller is still alive and the error
  reports `Timeout()`, this was our own timeout, and it returns
  `ErrProviderTimeout`.
- The **capability** checks `ErrProviderTimeout` *first* in `shouldFallover`, before
  the context-error arm that would otherwise claim it.

A provider timeout now also counts as a paced retry: waiting is the right answer to
a provider too loaded to reply, and retrying immediately is the worst available move.
The fix reaches reasoning and inference as well, where a timed-out provider now falls
over to the next candidate route instead of failing the call.

The timeout error wraps `ErrProviderTimeout` with `%w` and the underlying error with
`%v` — deliberately. Wrapping both would leave `context.DeadlineExceeded` matchable
through it and quietly undo the whole distinction.

## Gates

Eleven embed tests (six new) plus five in the provider. Two pairs are the
load-bearing ones, and each pair pins a direction that could regress silently:

- `TestEmbedHonoursRetryAfterOverItsOwnBackoff` /
  `TestEmbedRefusesARetryAfterBeyondTheBudget` — honour the provider, except when
  honouring it would be unbounded. Asserted by timing against a ten-second backoff,
  which is the only observable difference between using the header and ignoring it.
- `TestOpenRouterOwnTimeoutIsTypedAsProviderTimeout` /
  `TestOpenRouterCallerCancellationIsNotAProviderTimeout` — the same two failures,
  same shape, classified apart, over a real `httptest` server held open past each
  deadline. Making a provider timeout retryable must not also make an abandoned
  caller retryable.

`TestEmbedStillAbandonsACancelledCaller` and
`TestEmbedRetriesAShortVectorListOnceWithoutWaiting` cover the other two arms of the
loop.

## Also

`openrouter.go.md` and `intelligence.go.md` were both whole-file verbatim dumps that
had drifted well before this change — `intelligence.go.md`'s copy of `Embed`
predated chunking entirely, and its `Options` had neither telemetry nor embedding
options. `intelligence.go.md` is now prose; `openrouter.go.md`'s dump of `post` was
brought current (it was also missing the `declaredError` check its own prose
describes). Same convention drift as the four rewritten in 0152.

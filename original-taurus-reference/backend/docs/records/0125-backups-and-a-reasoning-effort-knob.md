# 0125 — Backups for every tier, none for embeddings, and an effort knob

Three changes to the model boundary, all from reviewing what OpenRouter
actually guarantees after a provider-degraded window failed two live suites
([0123](0123-live-suite-repairs.md)).

## "OpenRouter routes around outages" is only half true

OpenRouter multi-hosts **open-weight** models — DeepSeek, Qwen and friends are
served by several competing hosts and a request load-balances across them. A
**closed** model has exactly one upstream: `openai/gpt-4o-mini` can only come
from OpenAI, so its uptime is that one vendor's uptime. That is how a literal
"reply with pong" call returned 502. Uptime is a property of the model chosen,
not of OpenRouter.

Before this, the cast tables had exactly **one** fallback row in the whole
config. Now every reasoning and inference tier lists two: its primary, then a
backup.

**The backup rule, corrected.** The first version of this made DeepSeek back
DeepSeek. That is wrong, and the live runs showed why: `deepseek/deepseek-r1`
returned `429 … temporarily rate-limited upstream` 130 times in a single run,
and a rate limit that applies to a model family takes the backup with it. A
backup must be a **different vendor**, not merely a different slug. Which
vendors belong where is settled by measurement, not taste — see
[0127](0127-model-frontier.md).

## Embeddings get no backups — enforced, not advised

Vectors from different models are incomparable, and every stored source records
the identity it was embedded with; a fall-over would embed queries into a space
the corpus is not in and silently match nothing. So: **no embedding fallbacks,
ever.** `intelligence.New` rejects an embedding cast with more than one route at
startup (`TestDuplicateEmbeddingRoutesAreRejected`, written first). The test
that previously celebrated embedding fall-over is gone — it pinned behaviour we
now consider a misconfiguration.

## A per-route reasoning-effort knob

Routes gain an optional `Effort` (`"low"|"medium"|"high"`), threaded through
config → wiring → `Route` → the provider request → OpenRouter's
`reasoning.effort`. It belongs to the **route**, not the request: it is part of
the model choice, and callers ask for a cast, never for a model or a thinking
budget. A cheap model told to think harder is a distinct point on the
cost/quality frontier, and this is what lets us measure it. Empty leaves the
model's default alone, and a model without the knob ignores it, so an
unsupported effort degrades rather than failing the call.

## Host routing: deliberately not built

OpenRouter's request body accepts a `provider` object (`order`, `only`,
`ignore`, `sort`, `allow_fallbacks`) to steer which upstream host serves a
model. It is tempting as a 429 remedy, but their documented default is to
**load-balance across the top hosts to maximise uptime**, and setting `sort`
switches that off in favour of sequential routing. Reaching for it would
therefore likely make rate-limit exposure worse, not better. The levers we keep
are the default balancing plus a cross-vendor backup; `ignore` is worth adding
only if a specific host is shown to be the problem.

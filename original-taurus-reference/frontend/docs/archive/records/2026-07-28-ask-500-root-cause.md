# 2026-07-28 — Narrowing the Ask 500 by measurement, and what it changed

Structured root-cause work on the intermittent `500 "chat operation failed"`, driven by the
user pushing back on each stage of it. Nothing was fixed here — all the code involved is
Omega's — but the request now carries evidence instead of a guess, and one of its three asks
is new and probably the actual bug.

## What the earlier claim got wrong

The first version said "~4% of turns fail, and every failure was under a non-default persona;
120 default-persona turns succeeded." **The comparison group was mostly invalid.** 108 of those
115 "other turns" were Plan/Action turns, which spawn a durable task and never reach the Ask
citation contract at all. The genuine default-persona Ask sample was about **seven** turns —
far too few to conclude anything at a ~9% rate.

## The controlled measurement

Same prompt, same project shape, one variable changed:

| Persona | Ask turns | 500s |
| --- | --- | --- |
| "Be concise." (project persona) | 56 | 5 (~9%) |
| Requester default | 24 | **0** |

Zero in 24 would occur ~10% of the time if the rate were identical, so the persona is
implicated without being proven. Two model batches, ~2 minutes of calls, inside the timebox
the user set.

## The finding that reframed it

Reading what the **successful** custom-persona turns replied — "Ping received. Ready to edit.",
"Success. Proceed with edits." — showed conversational answers, where a default-persona Ask
against an empty project answers *"There is no available evidence to provide…"*. The same
prompt is being routed two ways by Omega's triage, and only the retrieval-routed path can fail
this way.

Then the user's design instinct landed the real candidate. Omega's `decodeAnswer` rejects an
empty answer **unconditionally**, even though the schema already carries
`InsufficientEvidence bool`. So a model that correctly reports "no evidence" *structurally* and
returns no prose is treated as having produced invalid output — and a persona told to be
concise is exactly the one likeliest to do that. As the user put it: if we want to say a
specific thing, we should say it ourselves rather than requiring the model to phrase it.

## The blocker, which is a bug against Omega's own intent

We still cannot say which of three rejections the 9% is, because the cause is discarded.
`chatErr` sets `resp.Err`, `transport/response.go` calls `requestlog.AttachError`, and
`requestlog.Record` has an `error` field — and the handler's comment says outright that "a 500
with no recorded reason cannot be diagnosed afterwards". The field never appears in the log.
Verified on a complete failure line.

## The request, rewritten

`ask-turn-500-missing-citation.md` → **`ask-turn-500s.md`** (the old name asserted a cause that
is no longer the leading one). Three asks, ordered:

1. **Record the cause you already intend to record** — smallest, and it turns the rest into one
   grep.
2. **Do not require prose when `insufficientEvidence` is set** — with the suggested
   `decodeAnswer` shape, and the general principle: *when an outcome can be a field, it should
   not also have to be a sentence.*
3. **The citation rule itself**, to confirm or eliminate once (1) lands.

Plus two small logging asks the user identified: the triage decision per turn, and the raw
rejected model output — currently the one artefact that would settle this is discarded at the
moment it becomes interesting.

The README handover no longer claims request 1 is simply caused by request 3; it now says they
are related, names the narrower candidate, and says to do the logging fix first.

## Method note

Three explanations were eliminated by measurement rather than argument: load/timing, the prompt,
and the Plan/Action path. Each elimination came from data already on disk or from a two-minute
probe — no twenty-minute experiments. That is the pattern to repeat.

## Verification

Docs only; no source changed. Links 0 broken · 7 request files / 6 table rows + README.

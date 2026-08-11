# 0131 — Measure every model call

Record 0130 was diagnosed with a throwaway test suite and a temporarily enriched
error message, because nothing in the running system would say what a turn had
done. This adds the instrument that should have been there: one measured event
per provider call, through the central logger.

## What was missing

`telemetry.Recorder` existed and was called from exactly **one** place — connector
sync. Every model call in the system was unmeasured.

Three facts were structurally unavailable, and each changes a decision:

- **Latency.** Response speed is a product constraint (there is a 60s provider
  timeout), but time was only ever reconstructed from log timestamps after the
  fact. A model failing purely by being slow looked identical to one failing on
  quality.
- **Which model actually served a request.** A cast lists ordered fallbacks, so a
  successful response says nothing about whether the primary answered or a backup
  absorbed a failure.
- **A tool loop's shape.** Rounds and tool calls separate an agent that did the
  job once from one that repeated itself — the exact ambiguity left open when a
  demo re-did finished work and no evidence could settle it.

## Where it lives, and why there

`core/capability/intelligence` is the only place where all four facts are known at
once: duration, the route that actually served the call, its token cost, and the
loop's shape. Anywhere upstream some of that is already lost — a caller sees a
`Result`, not the two failed attempts a fallback absorbed on the way.

`Telemetry` is a narrow port rather than a direct dependency on the platform
package, matching how `connector` reports its sync cost. The composition layer
adapts `intelligence.CallEvent` to `telemetry.Call`.

Three deliberate choices:

**Failed calls are always recorded.** `RecordCost` drops zero-token events
because nothing happened. A zero-token *call* means something happened and
produced nothing — it still spent wall-clock, and if it failed it is the most
informative event in the log. Dropping it is how a run that burned thirty seconds
on two rate-limited attempts becomes indistinguishable from one that answered at
once.

**A 200 returning unusable JSON counts as a failure.** It spent tokens and time
and produced nothing usable, then fell through to the next candidate. Recording
it as a success because the HTTP status was 200 would hide exactly the waste this
log exists to surface.

**The tool loop reports once, deferred.** One event per loop, not per round —
rounds and calls only mean anything as totals. It is recorded through a deferred
closure on a named error return because the loop's interesting exits are the
early ones (a limit trip, an unparseable final answer), and reporting at each
`return` would work until someone added an exit and forgot.

## First full-suite measurement

158 provider calls, **zero failures and zero fallback engagements** — the primary
route served every call, which is a health fact no response could have reported.

| Operation | Calls | Tokens | Prompt share |
|---|---|---|---|
| `reason.tools` | 6 | 58,792 | **90%** |
| `reasoning` | 73 | 36,010 | 84% |
| `embedding` | 78 | 1,671 | 100% |

**Prompt tokens are the bill.** 84–90% of all spend is input, so prompt text
length and tool-loop round count drive cost — not output length. A continuation
loop re-sends its history every round, so a 5-round loop pays for its history five
times.

**The Action loop is the run.** On `live-document`, one call took 23.0s and
20,508 tokens over 5 rounds and 10 tool calls — more than every other call in that
suite combined. That reframes model selection: whole-suite timing is mostly this
one call plus a dozen small ones, so tuning the cast that serves it is worth more
than tuning any other.

**Prompt blocks resolve as plan+synthesis pairs**, a 2–5s call followed by a
0.8–2.9s call. Neither was separately visible before; the suite reported one
blended total. This is the evidence WS-1 needs to give the two steps different
casts.

## What it priced — and what it corrected

**The solid measurement.** A prompt-block synthesis call measured **774 prompt
tokens before** record 0130's rule was added and **922 after** — **+19% on every
call of that kind**, read directly from the block's own `usage` field, same call
type, same suite. Those rules bought two real bug fixes and were worth it; the
point is that "add a rule to the prompt" is a priced decision rather than a free
one.

**The claim that did not survive.** I first reported the suite moving
`0.017905 USD` → `0.021496 USD` as evidence of that prompt cost. The next run, with
identical prompts, came in at `0.017849 USD`. So the suite-level movement was
variance, not the prompts, and the per-call measurement is the only part of that
claim the evidence supports.

Two things make the suite total unusable for this comparison, and telemetry
exposed both:

**Run-to-run variance is larger than the effect.** The tool loop dominates
spending and its round count is not stable: the same suite made loops of 3/4/2/5
rounds on one run and 2/4/2/8 on the next, moving `reason.tools` from 58,792 to
71,158 tokens — **+21% on the largest line item** with nothing changed.

**The suite's cost line under-reports.** `track_usage` scrapes `totalTokens` out
of a response body with `head -n1`, and only where a suite calls it. It therefore
misses every call whose usage a suite does not surface, and counts only the first
usage block in a response that carries several. Telemetry measured **108,342
tokens** on the cheaper-looking run against **96,489** on the dearer one — the
run that spent 12% more reported 17% less.

That is the more important finding: **the dollar figure printed at the end of
every run so far has been a partial accounting.** It was the only number we had,
so it was reasonable to quote, but per-call telemetry now supersedes it and the
two disagree. Making the runner total from telemetry rather than from scraped
response bodies is the obvious follow-up.

The general lesson is one this project keeps re-learning: a single before/after
run is not a measurement when the underlying variance is unmeasured. It is
measurable now.

## Also flagged, not fixed

`DELETE /agent/chats/:id/attachments/:id` returns 204 through the JSON response
path, so the transport tries to write a body and `net/http` refuses:

```text
"status":204,"error":"http: request method or response status code does not allow body"
```

Cosmetic — the client receives a correct 204 — and newly visible because of record
0130's cause logging. Recorded in
[live-document-walkthrough.md](../architecture/live-document-walkthrough.md) with
the one-line fix, deliberately left out of scope here.

## Known gap — closed in the follow-up below

The log attributes a call to a cast and a model, **not to the task or chat turn
that caused it**. Summing one agent run's true cost still means correlating by
timestamp. That is the "and per task" half of WS-6b, addressed at the end of this
record.

## Verification

Full suite on the shipped `etc/config.yaml`: **40 suites green**, `0.021496 USD`,
158 measured calls.

---

## Follow-up: per-task attribution

The gap this record closed with one exception — a call was attributable to a cast
and a model, but not to the work that caused it — is now closed too.

`intelligence.WithSubject(ctx, subject)` tags a context with the unit of work
whose provider calls follow, and every `CallEvent` carries it:

- `task:<id>` — set once in `Workflows.RunJob`, so a run's planning call, tool
  loop and any corrective re-ask are charged together
- `chat:<id>` / `ask:<projectID>` — set in `Ask.Run`
- `document:<docID>#<blockID>` — set in `ResolveBlock`, block-level rather than
  document-level because blocks resolve and cost independently

**The first subject wins.** Work nests — a task runs an Ask, which plans and then
answers — and the outermost scope is the one a cost belongs to. If an inner scope
could re-attribute, one run's spend would be split across two subjects and both
would be undercounted, which is the opposite of the point. That rule is also what
makes `WithSubject` safe to call unconditionally at every boundary: no caller has
to know whether it is the outermost.

The subject travels in the context rather than in each request struct because it
is ambient to a unit of work, not a property of a call. Threading it through four
signatures would put the same value in four places and let any one of them
forget — and the one that forgot would silently under-report.

The document capability receives an `Attributor` function port rather than
importing intelligence, matching how it already takes `PromptModel` and
`Retriever`. A nil `Attributor` leaves calls unattributed, which costs only the
ability to sum one block's spend.

### What one task looks like now

```text
call: reasoning    [task:019a79c9…] gpt-5.6-luna — 2.842s,   389 tokens
call: embedding    [task:019a79c9…] text-embedding-3-small — 376ms, 40 tokens
call: embedding    [task:019a79c9…] text-embedding-3-small — 268ms, 21 tokens
call: reason.tools [task:019a79c9…] gpt-5.6-luna — 27.159s, 35,913 tokens, 8 round(s), 15 tool call(s)
```

One filter, one task's whole bill. That run also took **8 rounds and 15 tool
calls** where the previous one took 5 and 10 — the same objective, the same
model, 75% more work. Run-to-run variance in agent effort is now a measurement
rather than a suspicion, which is what WS-3's ranking needs.

---

## Follow-up 2: the run cost we have been quoting is ~4.5x low

`dev-test/call-cost.sh` computes a run's cost from its per-call telemetry, at
each model's real input and output rates. Run against the same full-suite log
that printed `0.017849 USD`:

```text
MODEL                            CALLS   FAIL     TOKENS  SECONDS        USD
openai/gpt-5.6-luna                 82      1     106585    254.5   0.079883
openai/text-embedding-3-small       81      0       1725     24.5   0.000034
openai/gpt-4.1-nano                  2      0         32      1.0   0.000004
TOTAL                              165      1     108342    280.0   0.079921
```

**0.0799 USD actual against 0.0178 USD reported — 4.5x.** Two independent causes:

**Tokens are missed.** `track_usage` scrapes `totalTokens` from a response body
with `head -n1`, and only where a suite calls it. The reported figure implies
about 59k tokens; telemetry measured 108,342.

**Output is priced as input.** The suite multiplies total tokens by one flat
rate. Real models charge far more for output — `gpt-5.6-luna` is 0.50 USD/1M in and
3.00 USD/1M out, 6x. Output is only 10% of tokens here and **41% of the bill**,
so a flat rate is not a rounding error.

The price table lives in `dev-test/` rather than in the application, because a
price is an external fact about a vendor: the core resolves casts to models and
has no reason to know what one costs.

Every cost figure quoted in records 0129-0131 and in the walkthrough came from
the flat-rate scraper and is therefore a floor. The measured numbers supersede
them.

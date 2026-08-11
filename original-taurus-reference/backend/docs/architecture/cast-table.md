# The cast table: what it is, what it currently does, and what it should do

A cast is what application code asks for: `(purpose, strength, speed, cost)`.
Nothing in the codebase names a model. Configuration maps each of the 27
coordinates per purpose onto a provider and model, so the cast table is where
model policy lives — and it is the only place a caller's intent gets honoured or
quietly ignored.

Print the current one with `./dev-test/cast-table.sh`, which reads
`etc/config.yaml` so it cannot go stale.

## What it currently does

For `reasoning` and `inference`, purpose `general`:

| strength | speed | cost: low | cost: medium | cost: high |
| --- | --- | --- | --- | --- |
| low | low | `gpt-4.1-nano` | `gpt-4.1-nano` | `gpt-4.1-nano` |
| low | medium | `gpt-4.1-nano` | `gpt-4.1-nano` | `gpt-4.1-nano` |
| low | high | `gpt-4.1-nano` | `gpt-4.1-nano` | `gpt-4.1-nano` |
| medium | low | `gpt-4.1-mini` | `gpt-4.1-mini` | `gpt-4.1-mini` |
| medium | medium | `gpt-4.1-mini` | `gpt-4.1-mini` | `gpt-4.1-mini` |
| medium | high | `gpt-4.1-mini` | `gpt-4.1-mini` | `gpt-4.1-mini` |
| high | low | `gpt-4.1-mini` | `gpt-4.1-mini` | `claude-3.5-sonnet` |
| high | medium | `gpt-4.1-mini` | `gpt-4.1-mini` | `claude-3.5-sonnet` |
| high | high | `gpt-4.1-mini` | `gpt-4.1-mini` | `claude-3.5-sonnet` |

Two things are wrong with this, and neither is a typo.

**`speed` is inert.** All 27 coordinates ignore it. A caller asking for
`speed: high` gets exactly what a caller asking for `speed: low` gets. That is
worse than not having the axis: the caller believes they expressed a preference,
and the system silently discards it.

**`cost` is inert except in one corner.** It decides something only at
`strength: high, cost: high`. The other 24 coordinates route on strength alone.

So of a three-axis cube, one axis works, one works in 3 cells of 27, and one does
nothing at all. `strength` carries the whole table.

Embedding is different and deliberately so: one model at every coordinate,
because vectors from two models are not comparable and a cast change must never
silently make the corpus unsearchable. That table is correct as it stands.

## What the measurements say

From `docs/test-reports/model-choice.md`, per call, purpose `general`:

Single-shot reasoning — 58 calls, the prompt-block plan and synthesis path:

| Model | s/call | USD/call | Suites |
| --- | --- | --- | --- |
| `gpt-4o-mini` | 1.15s | 0.000083 | 15/15 |
| `gpt-4.1-mini` | 1.07s | 0.000221 | 15/15 |
| `gpt-5.1` | 1.39s | 0.001028 | 15/15 |
| `gpt-5.6-luna` | 2.07s | 0.000424 | 14/15 |

Tool loop — 6 calls, where an agent takes many rounds:

| Model | s/call | Input/call | USD/call |
| --- | --- | --- | --- |
| `gpt-4.1-mini` | 6.97s | 5612 | 0.002944 |
| `gpt-5.1` | 10.79s | 6627 | 0.016646 |
| `gpt-4o-mini` | 11.79s | 7209 | 0.001321 |
| `gpt-5.6-luna` | 15.51s | 9217 | 0.006866 |

The shape worth noticing: **in single-shot work the three viable models are within
7% on latency and 2.7x apart on price; in the tool loop they separate on latency
instead.** `gpt-4o-mini` takes 28% more input tokens per call there, which is the
round count showing up as a number rather than an anecdote — it does more turns
to reach the same place.

That is what makes the axes fillable. Cost genuinely varies between these models;
speed genuinely varies, but only where the work loops.

## What the table should be

For `reasoning` and `inference`, `strength: medium` and `high`:

| | cost: low | cost: medium | cost: high |
| --- | --- | --- | --- |
| speed: low | `gpt-4o-mini` | `gpt-4.1-mini` | `gpt-5.1` |
| speed: medium | `gpt-4o-mini` | `gpt-4.1-mini` | `gpt-5.1` |
| speed: high | `gpt-4.1-mini` | `gpt-4.1-mini` | `gpt-4.1-mini` |

Three decisions in that, each traceable to a measurement:

**`cost: low` is `gpt-4o-mini`.** It passes every suite and is 2.7x cheaper per
call. Its cost is paid in tool-loop latency, which is the right thing to trade
away when the caller has said cost matters most.

**`speed: high` is `gpt-4.1-mini` at every cost.** It is the fastest model
measured in the loop by a wide margin, and a caller asking for high speed has
said which axis to spend on. This is the one place an axis overrides another, and
it is deliberate: `cost: low, speed: high` is a contradiction, and the table has
to resolve it rather than pick silently.

**`cost: high` is `gpt-5.1`, not `claude-3.5-sonnet`.** Not because sonnet is
worse — because it has never been run. See below.

## The gap: models in the table nobody has tested

| Model | Coordinates it serves | Calls in the last full ladder |
| --- | --- | --- |
| `gpt-4.1-nano` | 9 of 27 (all of `strength: low`) | 4 |
| `claude-3.5-sonnet` | 3 of 27 | 0 |
| `gpt-oss-120b` | fallback everywhere | 0 |

Twelve of 27 reasoning coordinates route to a model we have no evidence about.
`gpt-4.1-nano` is the sharpest case: it owns the entire `strength: low` tier and
has answered four trivial probes in the `intelligence` suite. Whether
`strength: low` is a usable tier or a trapdoor is currently unknown.

`gpt-oss-120b` being unexercised is less alarming — it is the fallback, and a
fallback that never fires is a healthy primary — but it does mean the failure
path is untested.

The next experiment is cheap and obvious: run the ladder with `gpt-4.1-nano`
substituted at medium and high strength and see what it passes. It is the
cheapest model in the table, so the run costs less than any so far, and it either
promotes nano into the cost floor or tells us `strength: low` needs a different
model.

## Why not just always use the best model

Because the cast is a contract with the caller, not a default. A prompt block
resolving in the background and a chat turn a user is watching have genuinely
different tolerances, and the table is where that difference gets expressed. An
inert axis means the difference cannot be expressed at all — which is the state
this document exists to end.

## A dead model is sitting in the table

`anthropic/claude-3.5-sonnet` is the primary at six coordinates — `strength: high,
cost: high` across all three speeds, for both reasoning and inference. OpenRouter
has retired it. The API answers:

```text
{"error": "No endpoints found for anthropic/claude-3.5-sonnet."}
```

Every request landing on those coordinates therefore pays a failed provider
round-trip before the fallback (`gpt-4.1-mini`) answers. The result is correct and
the latency is not, and nothing says so — a successful response looks identical
whether it came from the primary or the second attempt.

It is invisible because no suite exercises those coordinates. The three casts the
product actually uses are `general/high/medium/medium`,
`general/medium/medium/medium` and `general/low/high/low`; `cost: high` is never
requested, so the dead row is never hit in a test run.

Two things follow. The obvious one: replace it. The more useful one: **the cast
table needs a liveness check that does not depend on a suite happening to use a
coordinate.** Every model named in the config should be confirmed callable, which
is a catalogue lookup rather than a test run, and cheap enough to do on every
sweep.

`claude-3.5-sonnet` is also why "test the older generations" has a floor. The
only 3.x Anthropic model still listed is `claude-3-haiku`, and it does not support
structured outputs — every call this system makes uses a JSON schema, so it could
not run the suites at all. The generation depth available is set by what the
provider still serves, not by what we would like to compare.

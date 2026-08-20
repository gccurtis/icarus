# Research — one question

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | The turn you are on: what you asked, what came back, and what it produced | Screen header · Ask · Answer · Findings · Composer |

Anchored to one turn, not scrolled through all of them. The answer and what it
produced sit side by side, because accepting a finding is a judgment made while
reading the answer.

## Layout

| 1.35fr | 1fr |
| --- | --- |
| screen header | screen header |
| ask | findings |
| answer | findings |
| answer | findings |
| composer | composer |

## Screen header

Which thread, what kind it is, who is answering, and the way to a new one.

**Shows** — "Why did Feeder 12 fail twice?", `Question`, a Grid Analyst selector,
**New thread**

**Needs** — the thread's title, mode and persona. The persona control sets it for
the whole thread; there is no per-turn switch.

## Ask

The prompt, as a card, with what it was allowed to look at.

**Shows** — "You asked · 10:21" over "Was the coordination study ever redone after
the 2024 reconductoring?", then `Field reports 2024–25` and `Web`

**Needs** — the turn's prompt, its time, and the scope chips resolved for that
turn.

**Open** — the scope shown is the thread's, not the turn's. Per-request scope is
not stored, so reopening an old turn cannot show what it could actually see.

## Answer

The reply, its citations, and the trace of how it was produced — in that order,
so the claim comes before the machinery.

**Shows** — a paragraph of prose; two citation rows, each naming a source and
quoting the passage; then two small trace chips —
`lattice.retrieve · 4 regions · 1.2 s` and `web.search · 2 results · 2.8 s`

**Needs** — the message body, its sources with locators and excerpts, and its
tool calls.

## Findings

What the answer produced, as cards, each decided individually.

**Shows** — two proposed findings, each with a title, a one-line body, chips for
its sources and what it bears on, and **Accept**, **Edit**, **Dismiss**; then one
already accepted, marked as being in the lattice.

A finding is a conclusion you accept, not a passage you copied — which is why one
of them is marked *Inference* rather than pretending a source says it outright.

**Needs** — proposed findings for this turn, and accepted ones for the thread.

**Open** — a proposed finding has no state in the model. Proposed, accepted and
dismissed must exist before this region can be built.

## Composer

The next question, at the foot, framed by what the thread already is.

**Shows** — `Question mode` and "anchored to Q-14" across the top; a field reading
"Ask the next question…"; **Context** and **Web** buttons; a send control.

The Copilot's status-bar composer is disabled on this screen. This is the
conversation, and a second floating composer would be two ways to say the same
thing.

**Needs** — the thread's mode and anchor, and per-turn toggles for scope and web.

# What it can look up

| Selecting | What it is | Sections |
| --- | --- | --- |
| The Context row in the Context view | The agent's scope, and how it combines with what a request adds | Can look up · How it combines · Portability |

## Layout

| 300px |
| --- |
| can look up |
| how it combines |
| portability |

## Can look up

The Context, with both counts. The gap between contained and searchable is the
one that decides what the agent will actually find.

**Shows** — `Context · Field reports 2024–25`, `Contains · 96 resources`,
`Searchable · 88 of them`

**Needs** — the persona's `ResourceSet` with contained and indexed counts.

## How it combines

The rule: this Context, plus whatever the request adds. Project membership is
always enforced and is never one of the parts — it is applied after the union, not
as a term in it.

Changing this means editing the persona, not switching it off for one turn. The
section says so because the Copilot's scope panel shows this same Context as a
fixed row, and the two statements have to agree.

**Needs** — nothing beyond a clear statement of the composition rule.

## Portability

Starts collapsed.

**Open** — for a persona available everywhere, rules like "everything in this
project" resolve wherever it runs, but named resources and named project Contexts
do not travel. The editor blocks them until cross-project binding exists, which
means a global persona is materially more limited than a project one.

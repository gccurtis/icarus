# Overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | This Context: what it is, what it currently resolves to, whether it is saved | This Context · Right now · Saved · Used by |

## Layout

| 300px |
| --- |
| actions |
| this context |
| this context |
| right now |
| right now |
| saved |
| used by |

## This Context

Name and description, both editable. A Context needs a description more than most
things do: the name says what someone called it, the description says what it is
supposed to cover.

**Shows** — `Name · Everything but drafts`, `About · Everything the filing may
cite, minus template bodies.`

**Needs** — the `ResourceSet` record.

## Right now

What the rule resolves to at this moment, and how much of that can actually be
searched. The gap between the two numbers is the important one — 211 resources of
which 88 are retrievable is a very different scope from 211 of which 211 are.

**Shows** — `Contains · 211 resources`, `Retrievable · 88 of them`,
`Worked out · 12:04:31`

A Context is a rule, not a list: a document created tomorrow that fits the rule is
in it without anyone editing this. The section says so, because a count with a
timestamp otherwise reads as a stored result.

**Needs** — a resolve with a contained count, an indexed count, and the time it
ran.

## Saved

**Shows** — `Saved · revision 9`

**Needs** — the current revision and dirty state.

## Used by

A summary, with detail in the [Used by view](../scope/used-by.md). Starts collapsed.

**Open** — shown only for consumers the backend can truthfully query. There is no
universal reverse index of everything using a Context, so this section can never
claim to be complete and must say so.

## Panel furniture

The action row: **Duplicate**, **Delete** — the latter disabled.

**Open** — deletion is gated on the same missing reverse index. Deleting blind
would create silent broken scopes in Personas, prompt blocks and generated
outputs.

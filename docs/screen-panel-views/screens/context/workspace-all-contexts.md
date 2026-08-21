# Context — all Contexts

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from the Contexts view | Every saved scope, with what each resolves to right now | Header · Filters · Contexts · Warning |

## Layout

| 1fr |
| --- |
| header |
| filters |
| contexts |
| contexts |
| warning |

## Header

**Shows** — "Context" over "Saved scopes. Each is a live rule — what matches it
today is what an agent can look at today.", and **New Context**

**Needs** — the create route.

## Filters

**Shows** — a search over Contexts

**Needs** — a text search over names and descriptions.

## Contexts

Each scope as a row, with its rule said in words and its two counts.

**Shows**

| Name | The rule, in words | Contains | Retrievable | Used by |
| --- | --- | --- | --- | --- |
| Everything but drafts | Everything in the project, minus templates | 211 | 88 | 2 agents |
| Regulatory corpus | Documents, and the Filings set | 34 | 34 | 1 agent · 1 automation |
| Storm precedents | Nothing matches it right now | 0 | 0 | — |

*The rule, in words* is generated from the definition, not typed. It is what makes
the table scannable, and it is the same renderer the inspector uses.

*Contains* and *Retrievable* are separate columns because the gap between them is
the difference between a scope that looks right and one that works.

**Needs** — `ResourceSet` records, a rule-to-sentence renderer, live contained and
indexed counts, and the reverse query behind *Used by*.

**Open** — *Used by* can only ever list consumers the backend can truthfully
query. The column has to be honest about being partial, which is also why Delete
is gated.

## Warning

One line under the table, in the gap role: a Context matching nothing cannot be
used to narrow a search — an empty scope currently means the whole project, so it
would widen rather than narrow.

**Needs** — nothing. This is the model gap, stated where the zero-count row is
visible.

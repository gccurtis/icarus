# Context — one Context

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | The whole of what a Context does: what goes in, what comes out, and what survives | Screen header · Include · Minus · Take out · What that leaves · Try a search |

Two halves with a minus between them, then the result. That is the entire model,
drawn as arithmetic rather than as an expression tree.

## Layout

| 1fr | auto | 1fr |
| --- | --- | --- |
| screen header | screen header | screen header |
| include | minus | take out |
| include | minus | take out |
| what that leaves | what that leaves | what that leaves |
| what that leaves | what that leaves | what that leaves |
| try a search | try a search | try a search |

## Screen header

**Shows** — "Everything but drafts", `Saved`, "211 resources", **Duplicate**,
**Delete** (disabled)

**Needs** — the `ResourceSet` record and its live count.

**Open** — Delete is gated on a reverse-dependency query that does not exist.

## Include

The left half: everything that puts resources in, each term with what it
currently contributes.

**Shows** — a header reading "Include · 248 resources" with **Add**, then
*Everything in this project* — Including anything created later — 248, and
*Regulatory corpus* — Another saved Context, at its current contents — 34

**Needs** — the include terms, each resolved to a count.

## Minus

The operator between the halves. A single glyph, not a control.

It is a region because it carries the meaning: the two halves are not two lists,
they are a subtraction, and without the sign between them the screen reads as
"things in" and "other things in".

**Needs** — nothing.

## Take out

The right half, same shape as Include and accepting the same kinds of term.

**Shows** — a header reading "Take out · 37 resources" with **Add**, then *Every
template* — By kind — 37

**Needs** — the exclude terms, each resolved to a count.

**Open** — nested groups inside either half cannot be drawn as two flat lists.
Either the model stays one level deep, or this region needs a way to show a group
without becoming a tree again.

## What that leaves

The result: an eyebrow stating the count as of now, a filter, kind chips, then the
table.

**Shows**

| Name | Kind | In because | Updated |
| --- | --- | --- | --- |
| Q3 Resilience Memo | Document | Everything in this project | 4m |
| NERC-2025-winter-review.pdf | External file | Regulatory corpus | 4d |
| feeder-12-relay.pdf | External file | Regulatory corpus · via SharePoint | 6d |

*In because* is what makes a Context debuggable: every row says which term put it
there, and a connector-sourced file says which connector it came through.

Under the table, one line: "6 of 211 shown · a Context is live, so this list
changes as the project does."

**Needs** — a paged resolve, and per-result expression proofs from the resolver.

**Open** — those proofs do not exist. Without them the *In because* column is a
reconstruction, and for a nested reference it is guesswork.

## Try a search

A collapsed section at the foot: run a retrieval against this scope and see what
comes back. It is the only region that answers the question a Context actually
exists for.

**Shows** — a query field reading "What would an agent find in here?", then a
result with its source, page, quoted passage and scores; then "88 of 211 resources
have indexed material. The rest are here, but nothing in them can be retrieved
yet."

**Needs** — a retrieval call against the unsaved definition, with per-result
locators and scores.

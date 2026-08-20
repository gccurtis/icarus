# A Context

| Selecting | What it is | Sections |
| --- | --- | --- |
| A Context, from either subscreen | The scope itself: its rule in plain words, and what it resolves to | This Context · In plain words · Right now · Saved · Delete |

## Layout

| 300px |
| --- |
| this context |
| this context |
| in plain words |
| right now |
| saved |
| delete |

## This Context

Name and description, editable.

**Shows** — `Name · Everything but drafts`, `Describes · Everything the filing may
cite, minus template bodies.`

**Needs** — the `ResourceSet` record.

## In plain words

The whole rule as one sentence, generated from the definition.

**Shows** — "**Everything in this project** and **Regulatory corpus**, minus
**every template**."

This is the section that makes a Context reviewable by someone who did not build
it. Two halves in the centre show the same thing spatially; this says it in
words.

**Needs** — a renderer from the definition to a sentence.

**Open** — nested unions inside unions cannot be said as one flat sentence any
more than they can be drawn as two flat halves. Either the model stays one level
deep, or both this section and the centre need a way to show a group.

## Right now

**Shows** — `Contains · 211 resources`, `Retrievable · 88 of them`

Live: a document created tomorrow is included without editing anything.

**Needs** — a resolve with contained and indexed counts.

## Saved

Starts collapsed.

**Shows** — `Revision · 9`, `State · Saved`

**Needs** — the revision and dirty state.

## Delete

Disabled.

**Open** — gated until one query can find every Context, Persona, prompt block and
generated output depending on this one. Deleting blind would create silent broken
scopes, which fail at retrieval time rather than at delete time.

# Inquiry

| View | What it is for | Sections |
| --- | --- | --- |
| Inquiry | The questions and ideas this project is working on | Questions · Hypotheses |

The organisational layer above threads. A thread is an activity; a question is a
thing the project wants to know, and it outlives any one thread.

## Layout

| 300px |
| --- |
| actions |
| questions |
| questions |
| questions |
| hypotheses |
| hypotheses |

## Questions

Nested, because questions have parents, with the current thread's anchor marked.

**Shows**

- Why do feeders fail repeatedly? — Investigating
  - Why did Feeder 12 fail twice? — Investigating · anchored
  - Is Eastbrook exposed the same way? — Open
  - What did the 2024 study assume? — Answered

**Needs** — `Question` records with parent references and status.

**Open** — answering a child does not answer its parent, and the tree must not
imply it does. A parent showing "Investigating" while all its children are
answered is a legal and meaningful state.

## Hypotheses

Ideas being tested, with an assessment and a confidence.

**Shows** — *Relay coordination was never redone* — Testing · confidence 0.7;
*Vegetation was the shared cause* — Refuted · confidence 0.9

**Needs** — `Hypothesis` records with assessment and confidence.

**Open** — assessment is a human judgment, never a tally of supporting findings.
The panel must not compute it, and the confidence number needs an origin: who set
it and when.

## Panel furniture

The action row: **Question**, **Hypothesis**.

# Contexts

| View | What it is for | Sections |
| --- | --- | --- |
| Contexts | Every saved scope, so you can switch without leaving the subscreen | Saved |

The same list the library subscreen leads with, kept here so moving between
Contexts does not require a mode change.

## Layout

| 300px |
| --- |
| actions |
| search |
| saved |
| saved |
| saved |
| saved |

## Saved

Each Context with a plain-words summary of its rule and its current count.

**Shows**

- *Everything but drafts* — Everything, minus templates — 211
- *Regulatory corpus* — Documents and the Filings set — 34
- *Field reports 2024–25* — 12 resources and connector files — 96
- *Storm precedents* — Nothing matches it right now — 0

The summary is generated from the rule rather than typed, which is what makes the
list scannable.

**Needs** — `ResourceSet` records, a renderer from rule to a one-line summary, and
a live resolved count each.

**Open** — a zero-count Context is shown with a warning because an empty scope
currently broadens retrieval to the whole project rather than restricting it to
nothing.

## Panel furniture

The action row: **New Context**, **Duplicate**. A search over Contexts.

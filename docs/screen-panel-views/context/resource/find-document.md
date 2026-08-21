# Find

| View | What it is for | Sections |
| --- | --- | --- |
| Find | Search and replace inside this document | Results |

A context view rather than a dialog, so it does not cover the text it is
searching and does not have to be dismissed to read a result.

## Layout

| 300px |
| --- |
| search |
| results |
| results |
| results |
| footer |

*Search* is the query field in the pane header; *footer* is the replace field and
its button, pinned below the results.

## Results

Each hit in context, with the page it is on and what kind of content it came out
of. The second part matters: a hit inside a prompt block's output is not
something you can edit the same way.

**Shows**

- "…lost across the three **storm** events…" — p.2 · Body · block b_4f1
- "…comparable overhead segments under **storm** icing…" — p.2 · Prompt block output
- "…the 2024 **storm** precedent docket…" — p.5 · Body · block b_9a2

**Needs** — a search over the document body that reports, per hit, the block, the
computed page, and whether the block is authored or generated.

**Open** — replacing inside generated output is not possible; the next run
overwrites it. Those results have to be findable but not replaceable, and the
panel needs to say why.

## Panel furniture

The query field in the header, and a replace field with a **Replace** button at
the foot — disabled until the selected hit is replaceable.

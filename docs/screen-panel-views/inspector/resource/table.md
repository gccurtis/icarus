# A table

| Selecting | What it is | Sections |
| --- | --- | --- |
| A table in the document body | Its size, its structure, and the actions that change either | Size · Structure · Actions |

A document table is content, not a grid. It has no formulas, no addresses and no
calculation — that is what a spreadsheet is for.

## Layout

| 300px |
| --- |
| size |
| structure |
| actions |

## Size

**Shows** — `Rows · 4 (1 header)`, `Columns · 3`, `Column widths · 48% · 20% · 32%`

Widths are proportional, so a table survives a change of paper or gutters.

**Needs** — the table's row and column counts and its width distribution.

## Structure

The parts, as rows. Starts collapsed.

**Shows** — *Header row*; *Body rows* — 3

**Needs** — whether a header row exists, and the body row count.

**Open** — the model needs a header-row flag. Styling the first row differently is
not the same as declaring it a header, and only the latter survives a page break.

## Actions

**Insert row**, **Insert column**, **Delete table**.

**Open** — inserting relative to a selected cell requires cell selection, which
this lens does not have. Either the actions append, or a cell becomes selectable
and gets a lens of its own.

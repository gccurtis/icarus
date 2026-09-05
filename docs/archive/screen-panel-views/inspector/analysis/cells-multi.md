# Several table cells

| Selecting … | What it is | Sections |
| --- | --- | --- |
| More than one cell, dragged or shift-clicked across the table | What the block comes to | Crumbs · Together · Selection · In common · Actions |

**The figures are the point.** Selecting a block of cells is how anyone asks
"what do these come to", so the total is the first band rather than a summary at
the bottom.

The selection arrives as `at`: a comma-separated list of `row:column` pairs,
because a cell is a row and a column and neither identifies one alone.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | the members, as `row:column` pairs in `at` |
| `capabilities.analysis.resultFor` | Capability | each member's value, and the row and column it sits in |
| `capabilities.analysis.placementsOn` | Capability | how each column is summarised, for the units check |
| `analysisId` · `at` | Prop | the analysis and the members, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| together | `PanelSection` |
| selection | `PanelSection` |
| in common | `PanelSection` |
| actions | `PanelSection` |

The panel's title is the count — *4 cells*.

## Together

The figure, first.

**Example** — `3,914,000` total · `1,842,000` largest · `312,000` smallest — or,
across two units, "Customer-minutes 3,914,000 · 3 cells" and "Events 31 · 2
cells"

### Structure

- `PanelSection` *Together*
  - `PanelStats` → `PanelStat` ×3 — total, largest, smallest, on one column only
  - `PanelFields` — one field per column instead, where the members span more
    than one: its subtotal and how many cells it holds
- `PanelChoice` **Show as** — how the figures on this panel print

### Behavior

It is refused when the members span columns with different units, because
customer-minutes and event counts do not add.

**A subtotal per column is the honest form of that refusal.** It answers the
question for each unit separately instead of printing one number nobody can name.

Non-numeric cells are counted and excluded from the arithmetic, and the count
says so: silently skipping them would make an average over two values look like
one over four.

## Selection

The members, one row each.

**Example** — "Cedar Hill · Customer-minutes" `1,842,000` · "Cedar Hill · Events"
`14` …

### Structure

- `PanelSection` `flush` — one `PanelRow` per member, with a count

### Behavior

Selecting one opens [what is underneath it](mark.md). The list is bounded the
same way the row previews are, with the count beside it.

## In common

The properties the block shares.

**Example** — Substation "Cedar Hill, Rockvale" · Column `Mixed` · Summarise
`Mixed`

### Structure

- `PanelSection` *In common* → `PanelFields` — the rows the cells sit in as a
  plain field, then **Column** and **Summarise** as `PanelSelect`s, each reading
  *Mixed* where the members disagree
- `PanelNote` — that a set took on all of them
- `PanelNote` `tone="gap"`

### Behavior

*Mixed* is computed from the members. A block that all agrees hides what this
lens is here to show, which is why the default selection spans two columns.

## Actions

**Example** — **Filter to these**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` — one, not two
- `PanelNote` — the rule the press would add, once it has been pressed
- `PanelNote` `tone="gap"`

### Behavior

**One button, because a filter narrows rows.** It acts on the groups these cells
sit in rather than on the cells, and there is no rule that keeps part of a row —
so *Exclude these* has no meaning here and is absent rather than offered and
wrong.

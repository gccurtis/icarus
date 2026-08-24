# A table chart

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The table itself — its frame, **Inspect the chart**, or a click that hits no row | The table as a whole: what it holds, how much of it, and in what order | Crumbs · Actions · Shape · Contents · Columns · Rows · Drawing |

**A table makes no encoding decisions, which is what this lens is for.** A bar
chart's panel is full of questions about how a number becomes a height; a
table's is about shape — which columns, how many rows, what order — so those are
the bands, and there is no colour band at all.

Selecting *inside* the table opens [a row](row.md), [a column](column.md) or
[a cell](cell.md). This is what is left when the selection is the whole thing.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.resultFor` | Capability | the columns with their roles, the rows, and the ungrouped total |
| `capabilities.analysis.placementsOn` | Capability | the placement behind each column |
| `capabilities.analysis.sortIn` · `limitIn` | Capability | the order, and how much of the result is kept |
| `analysisId` | Prop | which analysis, where a caller already knows |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| actions | `PanelButton` |
| shape | `PanelStats` · `PanelFields` |
| contents | `PanelSection` |
| columns | `PanelSection` |
| rows | `PanelSection` |
| drawing | `PanelSection` |

## Crumbs

The analysis, then *Table*.

## Actions

**Example** — **Chart settings**

### Structure

- `PanelButton` — in the pane's own `actions` snippet, into
  [the chart lens](chart.md), which decides which kind is drawn at all

## Shape

How big it is, and how much of the whole.

**Example** — `3` columns · `6` rows drawn · `41` groups in all; then Title
"Outage minutes by substation" · Evaluated "4 minutes ago · 240 ms"

### Structure

- `PanelStats` — columns, rows drawn, groups in all
- `PanelFields` — Title and Evaluated

### Behavior

Rows-shown against the ungrouped total, always. A truncated table reporting only
what it drew would be a different table pretending to be the whole one.

## Contents

The result itself, as a bounded preview.

**Example** — a header, three rows, and a total line

### Structure

- `PanelSection` — counted *n of total*
  - `PanelTable` — the same prefix the Variables lens shows for a table value

## Columns

What each column reads.

**Example** — *Substation* — `substations.name` · *Customer-minutes* — `sum of
customerMinutes`

### Structure

- `PanelSection` `flush` — one `PanelRow` per column

### Behavior

A column is keyed by the placement that produced it, which is how selecting one
opens [that placement](placement.md).

## Rows

The order and the limit, together.

**Example** — Keep `10` · Of `41 groups` · Order by `Customer-minutes` ·
Direction `High to low` · **Sort** · **Limit**

### Structure

- `PanelSection` *Rows* → `PanelFields` — **Keep** as editable text, **Of** as a
  plain figure, and **Order by** as a `PanelSelect`
- `PanelChoice` **Direction**
- `PanelNote` — the order in a sentence, or that nothing orders the rows and so
  which of them survive the limit is arbitrary
- `PanelActions` → `PanelButton` ×2 — **Sort** and **Limit**, into
  [sort.md](sort.md) and [limit.md](limit.md)

### Behavior

**Rows and order are the same band.** A limit without a sort keeps an arbitrary
ten, and separating the two lets a reader set one and never see the other.

Both are applied to the preview above rather than described, because the rows
they act on are directly above the controls — a band naming an order the table
below it did not follow would be the one reading a reader cannot check.

An empty limit is no limit rather than a limit of nothing.

## Drawing

The few display switches a table has.

**Example** — Header row [x] · Banded rows [x] · Totals row [ ]

### Structure

- `PanelSection`, closed on arrival — `PanelToggle` ×3
- `PanelNote` `tone="gap"`

### Behavior

*Starts collapsed*, because none of it changes what the table says. None of the
three is a property a chart can hold, which the note states — and **Totals row**
is the one that also needs an answer from the evaluator, because a sum of sums is
not always the sum.

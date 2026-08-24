# A table cell

| Selecting … | What it is | Sections |
| --- | --- | --- |
| One cell of a table chart | A row and a column, and the rows that were collapsed to make it | Crumbs · Facts · Share · Show as · Underneath · Actions |

**A cell is computed, so it has no properties of its own.** There is nothing here
to set — the value came from a placement, a filter chain and a grouping — which
is why the panel is a reading of it and two ways out rather than a form.

Not [a spreadsheet cell](../resource/cell.md). That one has an address, a formula
and dependents; this one is a value in a projection and has none of the three.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which row, and which column in its `at` |
| `capabilities.analysis.resultFor` | Capability | the value, its row's group, its column's label, and the column total |
| `capabilities.analysis.placementsOn` | Capability | the placement the column came from |
| `capabilities.analysis.rowsUnder` | Capability | the source rows the cell collapsed |
| `analysisId` · `rowId` · `columnKey` | Prop | the analysis and the cell, where a caller already knows them |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| facts | `PanelFields` |
| share | `PanelMeter` |
| show as | `PanelSection` |
| underneath | `PanelSection` |
| actions | `PanelSection` |

## Crumbs

The analysis, the table, the row, then the cell.

## Facts

What it is, and what made it.

**Example** — Substation `Cedar Hill` · Column "Customer-minutes" · Value
`1,842,000` · From `outageEvents.minutes` · How "Sum over the rows in this group"

### Structure

- `PanelFields` — three fields always, and two more where a placement is behind
  the column
  - the group, labelled with the group column's own heading rather than *Row*
  - column, and value
  - **From** and **How** — the field the column came from, and the aggregation

### Props

*How* is written as a sentence — "Sum over the rows in this group" — because the
aggregation on its own is the half of the fact that does not say what it ran
over. **From** and **How** are absent rather than blank where the column has no
placement behind it: a computed column is a legal column and inventing a source
for it would be worse than saying nothing.

## Share

The value against its column.

**Example** — "Share of Customer-minutes" · 31% · "31% of 5,914,000"

### Structure

- `PanelMeter` — the share of the column total

### Props

The column is what a share is a share of. A share of the whole result would be a
different number and a different claim.

## Show as

How this panel prints the value.

**Example** — `Number` `Thousands` `Share`, with Number on

### Structure

- `PanelSection` *Show as* → `PanelChoice` — three readings, not a format string
- `PanelNote` — that the table still draws the value it drew

### Behavior

**Show as is this panel's own and says so.** A per-cell format has nowhere to be
stored, and a control that silently reformatted the table would be claiming
otherwise. What it changes is what this panel prints.

## Underneath

The source rows the cell collapsed.

**Example** — 3 of 214 rows: "2026-01-14 · Cedar Hill · 412,000" …

### Structure

- `PanelSection` *Underneath* `flush` — counted by the total
  - `PanelNote` — how many rows, and which variable they are in
  - `PanelTable` — a bounded prefix, with the total beside it
- `PanelNote` `tone="gap"`

### Behavior

A second query rather than a property of the result. The prefix is read
server-side with the total beside it: three rows must never read as all of them.

## Actions

The way down into the rows, and the two rules a cell can put on the definition.

**Example** — **What is underneath** · **Filter to this** · **Exclude**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` ×3
  - **What is underneath** — into [mark.md](mark.md)
  - **Filter to this** and **Exclude** — each titled with the rule in words
- `PanelNote` — the rule the press would add, once one has been pressed
- `PanelNote` `tone="gap"`

### Behavior

**Both narrow by the group rather than by the cell.** A condition on one cell has
no meaning: there is no stage that runs after the grouping for it to sit in, and
a rule that kept one measure of one group would leave the table with a hole in
it. Neither writes: each states the rule it would add.

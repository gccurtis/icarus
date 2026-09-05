# A table column

| Selecting … | What it is | Sections |
| --- | --- | --- |
| One column of a table chart — its heading | The placement behind it, and what it does to the rows | Crumbs · Facts · Heading · Summarise by · Order · Values · Drawing · Actions |

**A column is a placement wearing a heading.** Everything that decides what is in
it — the field, the summarising — belongs to the placement, so this lens edits
those rather than inventing a parallel set beside them.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which column is inspected |
| `capabilities.analysis.resultFor` | Capability | the column's role and label, and its values down the table |
| `capabilities.analysis.placementsOn` | Capability | the placement behind it: the field and the aggregation |
| `capabilities.analysis.aggregationsFor` | Capability | what the field's type permits |
| `capabilities.analysis.sortIn` | Capability | the order, which is the table's rather than the column's |
| `analysisId` · `columnKey` | Prop | the analysis and the column, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| facts | `PanelFields` |
| heading | `PanelSection` |
| summarise by | `PanelSection` |
| order | `PanelSection` |
| values | `PanelSection` |
| drawing | `PanelSection` |
| actions | `PanelSection` |

*Values* is present on a measure column only. A group column has no distribution
and says so in *Summarise by* instead.

## Crumbs

The analysis, the table, then the column.

## Facts

What it reads, and what kind of column it is.

**Example** — Key `customerMinutes` · Role `Measure` · Position "2 of 3" · From
`outageEvents.customerMinutes` · Type `number`

### Structure

- `PanelFields` — key, role and position always; **From** and **Type** as well
  where a placement is behind the column

### Behavior

**Open as a placement** is in the pane's own `actions` snippet rather than on the
*From* field, and it is disabled with its reason as a title where the column has
no placement — a computed column is a legal column, and a dead link on it would
read as a missing one.

## Heading

What the column is called.

**Example** — "Customer-minutes", over `sum of customerMinutes`

### Behavior

The authored heading is shown over the name the formula reads. A lens showing
only the replacement would hide the thing a reader has to match against the
definition.

## Summarise by

How the values collapse.

**Example** — `Sum` `Count` `Average` `Minimum` `Maximum`

### Structure

- `PanelSection` → `PanelChoice`, or a sentence on the group column

### Behavior

**The group column is not a measure and is not offered one.** Summarising the
column that names the rows would collapse the rows themselves, so the band says
what it is instead of showing a control that must not be used.

The offered set is what the field's type permits.

## Order

Whether the table is ordered by this column.

**Example** — [x] Order the table by this column · Direction `High to low` — "The
rows come back by Customer-minutes, high to low." · **Sort**

### Structure

- `PanelSection` *Order* → `PanelToggle` **Order the table by this column**, then
  `PanelChoice` **Direction**
- `PanelNote` — the order in a sentence, or which other column holds it, or that
  nothing orders the table
- `PanelActions` → `PanelButton` **Sort**, into [sort.md](sort.md)

### Behavior

**Order the table by this column is the sort, not a column property.** A table
with two columns each claiming their own order has no order at all — which is why
the note names the column that currently holds it rather than leaving this one
looking merely switched off.

## Values

What the column comes to, over the rows the table is showing.

**Example** — `5,914,000` total · `1,842,000` largest · `312,000` smallest — over
a three-row preview

### Structure

- `PanelSection` *Values*, present only on a measure
  - `PanelStats` → `PanelStat` ×3 — total, largest, smallest
  - `PanelTable` — a bounded prefix
- `PanelNote` `tone="gap"`

### Behavior

The preview is the rows as this column's own order would put them, directly under
the Order band — so an order it claims and the preview ignores is a claim the
reader can see is false.

## Drawing

Alignment, and nothing else.

**Example** — Align `End`

### Structure

- `PanelSection` *Drawing*, closed on arrival — `PanelFields` → *Align*, a
  `PanelSelect`
- `PanelNote` `tone="gap"`

### Behavior

*Starts collapsed.* Alignment follows the role by default — names lead, figures
trail — and it is not persisted, which the note says. **No number format here**:
how a figure prints is a property of the result rather than of one column, and
two places to set it would be two answers.

## Actions

**Example** — **Remove**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` `tone="danger"`
- `PanelNote` — that removing the column removes the placement that produced it

### Behavior

Removing it leaves nothing to inspect, so the panel falls back to
[the analysis](analysis.md) rather than to an empty lens on a column that is gone.

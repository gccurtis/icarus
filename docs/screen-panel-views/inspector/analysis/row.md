# A table row

| Selecting … | What it is | Sections |
| --- | --- | --- |
| One row of a table chart | The group it names, and every measure under it | Crumbs · Facts · Share · Measures · Drawing · Actions |

**A row is a group, not a source record.** Six rows came back from 4,182 events,
so "this row" is a substation and the events are underneath it — which is why
*What is underneath* is a button rather than the body of the panel.

The table's equivalent of [a bar](bars.md), and the same object drawn as text. It
is a separate lens because what you want off a row is every measure, and what you
want off a bar is one height.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which row is inspected |
| `capabilities.analysis.resultFor` | Capability | the row, the measure columns, and the column total for the share |
| `capabilities.analysis.placementsOn` | Capability | the placement behind each measure |
| `capabilities.analysis.sortIn` | Capability | the ordering the rank is against |
| `analysisId` · `rowId` | Prop | the analysis and the row, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| facts | `PanelFields` |
| share | `PanelMeter` |
| measures | `PanelSection` |
| drawing | `PanelSection` |
| actions | `PanelSection` |

## Crumbs

The analysis, the table, then the row.

## Facts

Which group, and where it sits.

**Example** — Substation `Cedar Hill` · Position "1 of 6 by Customer-minutes"

### Structure

- `PanelFields` — the group and its position

### Props

The group's field is labelled with the group column's own heading rather than
*Row*, so the fact reads as itself.

**Where it sits is a fact about the sort.** Third of six means nothing without
saying third by what, so *Position* carries the ordering that produced it — and
reads "— unordered" where there is none, rather than a bare number that would
look like a rank.

## Share

The leading measure against the column it sits in.

**Example** — "Share of Customer-minutes" · 31% · "31% of 5,914,000 drawn"

### Structure

- `PanelMeter` — the share of the first measure, with both figures as its detail

### Behavior

The first measure is what the row is usually being read for, and what the sort
orders by. Sharing every measure at once would be four bars answering a question
nobody asked.

## Measures

Every measure at this row.

**Example** — *Customer-minutes* `1,842,000` · *Events* `14`

### Structure

- `PanelSection` `flush` — one `PanelRow` per measure, with a count

### Behavior

Selecting one opens [its placement](placement.md), because the interesting thing
about a number in a row is usually how it was made.

## Drawing

How the row is drawn, and whether it is drawn.

**Example** — Label "Cedar Hill" · Hidden [ ]

### Structure

- `PanelSection` *Drawing* → `PanelFields` → *Label*, editable, placeholdered
  with the group's own name
- `PanelToggle` — **Hidden**
- `PanelNote` `tone="gap"`

### Behavior

Nothing stores a row's visibility, so *Hidden* is this panel's own and the note
says so.

## Actions

The way down into the rows, and the two rules a row can put on the definition.

**Example** — **What is underneath** · **Filter to this** · **Exclude**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` ×3
  - **What is underneath** — into [mark.md](mark.md), with a `Layers` glyph
  - **Filter to this** and **Exclude** — each titled with the rule in words,
    naming the group column rather than "the group" wherever the placement says
    what it is
- `PanelNote` — the rule the press would add, once one has been pressed
- `PanelNote` `tone="gap"`

### Behavior

**Both rules change the definition from a click on the table**, which is the
right gesture and one that has to be undoable in a single step — so each states
the rule it would add and adds nothing.

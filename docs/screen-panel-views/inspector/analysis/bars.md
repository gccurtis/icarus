# A bar

| Selecting … | What it is | Sections |
| --- | --- | --- |
| One bar on a bar chart | What the bar is drawn as, and what it stands for | Crumbs · Facts · Share · Series · Drawing · Actions |

**[mark.md](mark.md) answers what is underneath a bar; this answers what the bar
is.** Two questions, and one panel trying to be both would open on three source
rows when the reader clicked a colour they did not recognise. The way from here
to there is a button rather than a merge.

**A bar is a group and a series, never a group alone.** Two measures make two
bars over the same substation, and a lens naming only the substation would be
identical for both while describing one.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which row, and which series in its `at` |
| `capabilities.analysis.resultFor` | Capability | the row, the measure columns, and everything drawn in this series |
| `capabilities.analysis.chartFor` | Capability | the colour tokens |
| `analysisId` · `rowId` | Prop | the analysis and the bar, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| facts | `PanelFields` |
| share | `PanelMeter` |
| series | `PanelSection` |
| drawing | `PanelSection` |
| actions | `PanelSection` |

## Crumbs

The analysis, the chart, then the bar.

## Facts

Which group, which series, what it is worth, and where that puts it.

**Example** — Group `Cedar Hill` · Series "Customer-minutes" · Value `1,842,000`
· Rank "1 of 6 drawn"

### Structure

- `PanelFields` — group, series, value, rank

### Props

**Rank counts what is drawn, not what the result holds.** A bar's height is only
comparable with the bars beside it, so "1 of 6 drawn" is the honest denominator
and the ungrouped total would be a different claim.

## Share

The value against everything drawn in the same series.

**Example** — "Share of Customer-minutes" · 31% · "1,842,000 of 5,914,000"

### Structure

- `PanelMeter` — the share, with both figures as its detail

### Behavior

**The share is beside the value because a bar is read against its neighbours.**
1,842,000 says nothing on its own; a third of everything drawn says what the eye
is already claiming.

## Series

Which series this bar belongs to, and how to move to the other one over the same
group.

**Example** — `Customer-minutes ▾`

### Structure

- `PanelSection` → `PanelSelect` — every measure

### Behavior

Choosing another re-reads the panel for the same group in that series, which is
the fastest way to compare two bars that sit on top of one another.

## Drawing

How this one bar is drawn.

**Example** — Colour `accent-1`, its swatch under it · Label "Cedar Hill"

### Structure

- `PanelSection` *Drawing* → `PanelSelect` **Colour**
  - `PanelSwatches` → `PanelSwatch` — the chosen token, drawn
  - `PanelFields` → *Label*, editable, placeholdered with the group's own name
- `PanelNote` `tone="gap"`

### Behavior

Colour follows the series rather than the bar, and the note says so: a per-bar
colour has nowhere to be stored, and one that appeared to take would be a chart
whose encoding no longer means anything.

## Actions

The way down into the rows, and the two rules a bar can put on the definition.

**Example** — **What is underneath** · **Filter to this** · **Exclude**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` ×3
  - **What is underneath** — into [mark.md](mark.md), with a `Layers` glyph
  - **Filter to this** and **Exclude** — a funnel and a ban, each titled with the
    rule in words
- `PanelNote` — the rule the press would add, once one has been pressed
- `PanelNote` `tone="gap"`

### Behavior

**Both rules change the definition from a click on the picture.** That is the
right gesture, and it has to be undoable in one step before either can actually
take it — so each states the rule it would add and adds nothing.

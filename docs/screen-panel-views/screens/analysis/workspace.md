# Analysis — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only centre this screen has | One analysis: the picture, and the controls that drew it | Header · Chart · Kinds · Options · Grid |

**One centre, because a screen whose whole subject is one chart should not spend
half its states not showing one.** Which analyses exist is a map, so the library
of them is [a rail view](../../context/library/analyses.md) and the centre shows
whatever `view.active.focus` names.

**One title.** The screen has the analysis' own name; the chart's title, its save
state and Duplicate belong to
[the Overview panel](../../context/overview/analysis.md), not to a second header
on the plane.

**The chart is the analytic component the document, deck and spreadsheet editors
also embed.** What Analysis adds is not a different picture but a better place to
build one: the twelve kinds and the customisation panel exist here and nowhere
else.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which analysis; the rail's first row is the fallback |
| `capabilities.library.analyses` | Capability | the library rows, whose name tells the five analyses apart |
| `capabilities.analysis.analysis` | Capability | the `AnalysisRecord` |
| `capabilities.analysis.chartFor` | Capability | the kind, the titles, the legend and the colour tokens |
| `capabilities.analysis.resultFor` | Capability | the columns with their roles, the rows, and the ungrouped total |
| `capabilities.analysis.placementsOn` | Capability | what is on X and what is on Y |
| `capabilities.analysis.filtersIn` · `sortIn` · `limitIn` | Capability | what the definition already filters, orders and cuts by |
| `capabilities.analysis.aggregationsFor` | Capability | what a field of that type may be summarised by |
| `capabilities.analysis.relationship` | Capability | the inferred key between two variables |
| `capabilities.analysis.tablesIn` | Capability | every table variable and its fields, for Select data |
| `view.selection` | Model | which mark, row, column or cell is inspected |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| auto | minmax(0, 1fr) |
| --- | --- |
| header | header |
| chart | chart |
| chart | chart |
| chart | chart |
| kinds | kinds |
| options | grid |
| options | grid |

The board itself is one track — `auto`, `minmax(0, 1fr)`, `auto`. *Options* and
*grid* are the two tracks of the customisation panel, which is the only band that
splits.

**The picture takes everything the other two leave.** `minmax(0, 1fr)` rather
than `1fr`, because a grid row's automatic minimum is its content and a chart
band that cannot shrink below its content is the one thing that would make this
screen scroll. **Nothing scrolls**: a chart you have to scroll to is a chart you
cannot read against its own controls, which is the entire argument for this
screen existing rather than an editor's inspector doing the job.

## Header

The analysis, and what the screen is.

**Example** — "Outage minutes by substation" over "The chart is the analysis.
Everything under it is how it got that way."

### Structure

- `ScreenHeader` — title and `about`

### Props

The title is the library row's name where there is one. `analysis()` is still a
stub that answers with the one saved definition whatever it is asked, so its
title cannot tell the five analyses apart and the row's can.

## Chart

The picture at the size that makes it readable, and the two captions under it.

**Example** — six columns, the tallest marked, a legend on the right; underneath,
"Generated from current data — the result itself is not stored" and "Showing 6 of
41 · limit 10", with **Inspect the chart** at the end of the row

### Structure

- a bordered frame holding the stage
  - `ScreenTable` — for the Table kind: the group column, then one per measure
  - `PlotBars` — for the Bar kind, given the `ChartSpec`
  - `ScreenEmpty` — for the other ten kinds, and for a result the conditions
    emptied
  - a legend, one entry per measure
- `ScreenNote` — the two captions
- `Button` — **Inspect the chart**

### Props

The plot's height is measured off the band rather than guessed, which is what
lets the picture be the bulk of the screen at any window size without the screen
scrolling.

**The spec is what the chart *is*, separately from how it is drawn** — the same
object an inspector preview or a slide would render at another size. Its colours
are the definition's tokens, so a chart pasted into a deck is the deck's palette.

### Behavior

**The bars draw one measure, and the sort names it.** Y holds two aggregates five
orders of magnitude apart; drawn as two series the second is zero pixels tall. The
measure the sort orders by is the one with a height, the others are named in the
legend as *not drawn*, and changing the sort target changes which one that is.

Clicking a bar inspects [it](../../inspector/analysis/bars.md); shift-clicking
several passes the members in the selection's `at`. Clicking the plot background
clears the selection and inspects
[the chart](../../inspector/analysis/bar-graph.md) — and **Inspect the chart** is
the keyboard path to the same place.

In a table, the heading opens [the column](../../inspector/analysis/column.md),
the name cell [the row](../../inspector/analysis/row.md), and a figure
[the cell](../../inspector/analysis/cell.md).

Both captions stay. The first stops a chart being mistaken for a stored result;
the second stops a truncated view being mistaken for the whole, which needs the
limit as well as the two counts.

## Kinds

The twelve kinds, centred, wrapping rather than scrolling.

**Example** — `Table` **Bar** `Cluster` `Line` `Bar-Line` `Pie` `Scatter` `Area`
`Histogram` `Boxplot` `Heatmap` `Mekko`

### Structure

- `ToggleGroup` `type="single"` — centred and wrapping
  - `ToggleGroupItem` ×12 — each with an icon and its name

### Behavior

**Twelve are offered and two are built.** The other ten are selectable and say
what they are rather than being greyed out — the vocabulary is what a person is
choosing from, and hiding ten of it to avoid admitting they are unbuilt would
misrepresent the screen. Choosing one puts a `ScreenEmpty` on the stage naming
the kind, and says the result underneath is unaffected.

All twelve are read at once, which is why the row wraps rather than scrolling.

## Options

Four buttons, stacked, naming what can be customised.

**Example** — **X-Axis** · **Y-Axis** · **Data** · **Labels**, with X-Axis on

### Structure

- a `nav` of four buttons, the chosen one marked

### Props

Four, not six. Filters, sort and limit are not places to put a field: they are
*Set condition* and *Sort* inside whichever option they apply to, which is where
someone actually thinks about them.

### Behavior

**Buttons rather than a toggle group**, because pressing the option you are
already on has to re-open its lens and a toggle group calls nothing when the
value does not change.

Choosing one swaps the grid beside it and inspects it. The lens is the long form
of the grid, so the compact controls and the full set are available at once.

Below 60rem the column becomes a wrapping row: the options list stops being a
column long before the plane runs out.

## Grid

The controls for the chosen option. What is in it varies with the option and with
the kind.

| Option | What the grid offers |
| --- | --- |
| X-Axis | Select data · Create join · Sort · Set condition |
| Y-Axis | Select data · Create join · Sort · Set condition |
| Data | Select data · Select aggregation · Set condition |
| Labels | Options, and a replacement per column |

**Example** — for X-Axis: a field select reading `substations.name` over "Or drop
a table variable here"; a join reading "substations and outageEvents line up on
`subId → id` — 38 of 41 match" with **Change the join**; a sort by
`Customer-minutes`, `High to low`; and a condition of a field, an operator and a
value, under "Already filtered by region is Northwest"

### Structure

- one `control` per column of the table above, in a wrapping grid
- for Labels: `PanelToggle`s — **Compact figures**, and on a bar chart **Figures
  on the bars** and **Bars along the side** — then a `PanelInput` per result
  column, placeholdered with that column's own label

### Props

A control a kind cannot answer is absent rather than greyed out: a table has no
bars to put figures on and no orientation to take.

The condition operators are `is`, `is not`, `≥` and `≤`. *Between* is not offered
— it wants a second value, and this row has one field for one.

### Behavior

**What can act on the result acts; what would rewrite the definition opens a
lens.** Sort, the conditions and the label options run over what came back, so
they take effect on the spot. Select data, Create join and Select aggregation
change what the analysis *is*, and a mock door has nothing to write to — so those
hold their choice locally and hand the real edit to the inspector.

**A condition per option, ANDed.** That is how the definition chains its own
filters, and why three panels can each hold one without fighting. Each says what
the definition already filters on, so a new condition is read against it, and an
emptied result offers **Clear** rather than a blank stage.

**A variable can be dragged in from
[the rail's Variables view](../../context/project/variables.md)** and dropped on
Select data. The drag carries the variable's id; a table resolves to its first field,
because a select here holds a field and a table is not one, and anything that is
not a table is ignored rather than guessed at. Every control also has a menu and
a keyboard path — nothing here is drag-only.

**Label replacements are real.** They name the axis, the legend and the table's
headings, and an empty one falls back to the column's own label rather than
drawing nothing.

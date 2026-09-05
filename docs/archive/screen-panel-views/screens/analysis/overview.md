# Analysis — panels

A space to explore, analyse and synthesise data. Project variables are just
variables: there is no root table and no join step to get through first. Where
two fields need relating, the join is stated inside the axis that needs it.

**A tab is one analysis**, keyed by the chart the same way a Research tab is
keyed by its thread: a chart is opened, worked in and closed, so two of them are
two tabs and one reached three ways is one tab. Analysis is therefore not a
permanent tab — there is no place here you return to, only charts you open.

**One centre.** Choosing which analysis to look at is navigation and navigation
belongs in the map, so the library of analyses is a rail view rather than a
centre of its own. A screen whose whole subject is one chart should not spend
half its states not showing one.

The chart on this screen is the analytic component the document, deck and
spreadsheet editors also embed. What Analysis adds is the interface for building
and customising it.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/analysis.md) | The analysis itself: what it is called, whether it is saved, what it last produced | This analysis · Saved · Result · Attribution |
| [Variables](../../context/project/variables.md) | The project's named values | Actions · Search · Filters · Variables |
| [Analyses](../../context/library/analyses.md) | Every chart built on this project's variables | In this project |

Overview carries **Copy formula**, **Duplicate** and **Delete**. They are facts
about the analysis as an object rather than moves you make while building one, so
they are in the panel that holds the rest of those facts and not in the screen's
header.

**Variables is the project's own Name Manager, not a second copy of it.** The
same view answers here as on a document, a deck and Project Overview, because a
variable is a project-wide name and writing the panel twice is how two copies
drift.

[Chart](../../context/analysis/chart.md),
[Fields](../../context/analysis/fields.md),
[Formula](../../context/analysis/formula.md) and
[a field-expanded Variables view](../../context/analysis/variables.md) are
written and are on no rail. The kind switcher and the four-button customization
panel hold what the first three offer, on the plane beside the picture they act
on. The fourth is the Analysis reading of the Name Manager — every table's fields
listed under it, because a chart takes a field and a formula takes a name — and
it stays written rather than railed until dragging a field is a thing that
happens.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| The X-Axis button | Data selection, join, sort and conditions for the horizontal | [x-axis.md](../../inspector/analysis/x-axis.md) |
| The Y-Axis button | Data selection, join, sort and conditions for the vertical | [y-axis.md](../../inspector/analysis/y-axis.md) |
| The Data button | Data selection, aggregation and conditions for what is measured | [data-button.md](../../inspector/analysis/data-button.md) |
| The Labels button | What is written on the chart, and what it is written as | [labels.md](../../inspector/analysis/labels.md) |
| A table chart | The table as a whole: its columns, its order, its shape | [table-graph.md](../../inspector/analysis/table-graph.md) |
| A bar chart | The bar chart as a whole: its scale, its base, its series | [bar-graph.md](../../inspector/analysis/bar-graph.md) |
| One bar | One mark, and the rows underneath it | [bars.md](../../inspector/analysis/bars.md) |
| Several bars | What the selected marks have in common, and how they compare | [bars-multi.md](../../inspector/analysis/bars-multi.md) |
| One table row | One row of the result, and where its values came from | [row.md](../../inspector/analysis/row.md) |
| Several table rows | The selection as a subtotal | [rows-multi.md](../../inspector/analysis/rows-multi.md) |
| One table column | One column: what it reads, how it is summarised | [column.md](../../inspector/analysis/column.md) |
| Several table columns | The selected columns side by side | [columns-multi.md](../../inspector/analysis/columns-multi.md) |
| One table cell | One value, and the rows behind it | [cell.md](../../inspector/analysis/cell.md) |
| Several table cells | The selected values, aggregated | [cells-multi.md](../../inspector/analysis/cells-multi.md) |
| A variable in the Variables view | A table or value, its contents, and how it relates to others | [variable.md](../../inspector/analysis/variable.md) |
| Nothing | The analysis itself | [analysis.md](../../inspector/analysis/analysis.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

Seven lenses are not on that list and are reached *through* it:
[chart.md](../../inspector/analysis/chart.md) from either graph lens,
[placement.md](../../inspector/analysis/placement.md) from a series or a column,
[filter.md](../../inspector/analysis/filter.md) from a condition,
[sort.md](../../inspector/analysis/sort.md) and
[limit.md](../../inspector/analysis/limit.md) from the table's Rows band,
[relationship.md](../../inspector/analysis/relationship.md) from Create join, and
[mark.md](../../inspector/analysis/mark.md) from any *What is underneath*.

**A lens per button, not per placement.** The plane has four buttons, so the
lenses it opens are about those four things — which field is on an axis is the
first question such a lens *asks*, not the thing it was opened on. A placement is
still a lens, reached through the button rather than being the way in.

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| The only one | The title, the chart, the twelve kinds, and the customization panel | [workspace.md](workspace.md) |

## The rules this screen keeps

**There is no root, no input and no join step.** Variables are variables. A join
is a control inside the axis that needs one, not a stage in front of the chart.

**Only Table and Bar draw.** The other ten kinds are named because the set is the
vocabulary; a kind that is not built says so rather than drawing something else.

**Nothing about the result is stored.** Results are replaceable projections. The
definition is what persists, which is why the chart carries "generated from
current data" under it.

**Nothing is drag-only.** Every control has a menu and a keyboard path.

**One title.** The screen has a title; the chart may draw its own, and that is a
different thing.

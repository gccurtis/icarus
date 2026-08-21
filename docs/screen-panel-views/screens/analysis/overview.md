# Analysis — panels

Drop a field on an axis and see a chart. Project variables are just variables:
there is no root table and no join step to get through first. When two fields
cannot be related, the screen says so and offers the fix.

Two subscreens: **one analysis** and **all analyses**. One Analysis tab; which
analysis you are on is view state.

## Context panel — one analysis

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/analysis.md) | The analysis itself, and running it | This analysis · Saved · Result · Attribution |
| [Variables](../../context/analysis/variables.md) | What can be charted, with fields expanded | Tables · Values · Functions |
| [Chart](../../context/analysis/chart.md) | What kind of picture to draw | The kinds |
| [Fields](../../context/analysis/fields.md) | Where each field has been put | X · Y · Filters · Sort · Limit |
| [Formula](../../context/analysis/formula.md) | What the builder compiled to | Compiled · Evaluation |

## Context panel — all analyses

| View | What it is for | Sections |
| --- | --- | --- |
| [Analyses](../../context/library/analyses.md) | Every chart in the project | In this project |
| [Variables](../../context/project/variables.md) | The project's named values | Actions · Search · Filters · Variables |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A field on an axis | One placement: the field, how it is summarised, what it is called | [placement.md](../../inspector/analysis/placement.md) |
| A variable in the Variables view | A table or value, its contents, and how it relates to others | [variable.md](../../inspector/analysis/variable.md) |
| The relationship warning | Two variables that need relating, and the fix | [relationship.md](../../inspector/analysis/relationship.md) |
| A filter | One rule about which rows are kept | [filter.md](../../inspector/analysis/filter.md) |
| The sort | What the result is ordered by | [sort.md](../../inspector/analysis/sort.md) |
| The limit | How much of the result is shown | [limit.md](../../inspector/analysis/limit.md) |
| The chart | Kind, title, axes, legend, colours | [chart.md](../../inspector/analysis/chart.md) |
| A bar, point or slice | One mark, and the rows underneath it | [mark.md](../../inspector/analysis/mark.md) |
| Nothing | The analysis itself | [analysis.md](../../inspector/analysis/analysis.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| One analysis | The chart first, then the drop zones that made it | [workspace-one-analysis.md](workspace-one-analysis.md) |
| All analyses | Every chart, as shapes | [workspace-all-analyses.md](workspace-all-analyses.md) |

## The rules this screen keeps

**There is no root, no input and no join step.** Variables are variables. You drop
a field and the chart appears.

**A relationship is a problem to solve, not a modelling step.** It appears only
when two variables are actually in play, stated as "two variables, no
relationship", with the match the system picked and the alternatives.

**Nothing about the result is stored.** Results are replaceable projections. The
definition is what persists.

**Nothing is drag-only.** Every drop zone also has an Add menu and a keyboard
path.

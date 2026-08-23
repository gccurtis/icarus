# Analysis — panels

Present the answer, then reveal the program that produced it. Project variables
normalize to tables, but there is no privileged root table. A dimension projects
one or more tables into lists, composes them with ordered extends or joins, and
the data channel names the relation it evaluates. When independently composed
dimensions do not yet share a relation, the screen says so and offers a bridge.

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
| A list in a dimension | Its source table, selector, operations, and display label | [placement.md](../../inspector/analysis/placement.md) |
| A variable in the Variables view | A table or value, its contents, and how it relates to others | [variable.md](../../inspector/analysis/variable.md) |
| The relationship warning | Two variables that need relating, and the fix | [relationship.md](../../inspector/analysis/relationship.md) |
| A filter | One rule about which rows are kept | [filter.md](../../inspector/analysis/filter.md) |
| The sort | What the result is ordered by | [sort.md](../../inspector/analysis/sort.md) |
| The limit | How much of the result is shown | [limit.md](../../inspector/analysis/limit.md) |
| The chart | Kind, title, axes, legend, colours | [chart.md](../../inspector/analysis/chart.md) |
| Any selectable chart mark | One bar, point, slice, step, segment, stage, cell or tile and the rows underneath it | [mark.md](../../inspector/analysis/mark.md) |
| Nothing | The analysis itself | [analysis.md](../../inspector/analysis/analysis.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| One analysis | Title, reusable analytic component, then chart-specific customization | [workspace-one-analysis.md](workspace-one-analysis.md) |
| All analyses | Every chart, as shapes | [workspace-all-analyses.md](workspace-all-analyses.md) |

## The rules this screen keeps

**There is no privileged root table.** Every input is named, every list projection
is explicit, and `data.from` names the relation on which ordered operations run.

**Relationships appear only when composition requires them.** Extend stacks
compatible dimension lists. Join matches two inputs. A bridge joins independently
composed relation sets before the data channel can aggregate across them.

**The definition and last good component persist together.** A stale or invalid
edit keeps the last complete chart or table visible with stable issue ids.

**Nothing is drag-only.** Every drop zone also has an Add menu and a keyboard
path.

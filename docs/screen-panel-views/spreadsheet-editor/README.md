# Spreadsheet editor — panels

One spreadsheet: a sparse grid, not a workbook of sheets. No formula bar, no name
box, no toolbar — the inspector already names the cell you are on and holds the
formula in it.

One subscreen.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](context/overview.md) | The spreadsheet as a whole | This spreadsheet · Calculation · Saved · From template |
| [Variables](../_shared/context/variables.md) | The project's named values | *shared* |
| [Named ranges](context/named-ranges.md) | Names local to this spreadsheet | This spreadsheet |
| [Find](context/find.md) | Search across values and formulas | Scope chips · Results |
| [Dependencies](context/dependencies.md) | What the current cell reads and feeds, and what is broken | *n* reads · *n* feeds · Problems |
| [Objects](context/objects.md) | Charts and overlays floating over the grid | One section per group |
| [Insert](context/insert.md) | Putting something new in | Charts · Content · Structure |
| [Styles](context/styles.md) | The named cell styles | Named styles |
| [Print](context/print.md) | Getting a grid onto paper | Page setup · Area and repeats · Show |
| [Comments](context/comments.md) | Conversation on cells | Scope chips · Open |
| [Context](context/context.md) | What prompt blocks here can look up | Saved Contexts |

Project variables and this spreadsheet's named ranges are two separate views on
purpose. They are different scopes and must not be mistaken for one another.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A cell containing a formula | The formula, what it reads, what it feeds | [cell-with-formula.md](inspector/cell-with-formula.md) |
| A cell containing a value | The value, its type, its format | [cell.md](inspector/cell.md) |
| A cell in error | What broke and how to repair it | [error-cell.md](inspector/error-cell.md) |
| A range | Shared formatting, aggregates, and range actions | [range.md](inspector/range.md) |
| A spill child | Where the values came from, and why it is read-only | [spill.md](inspector/spill.md) |
| A chart | Type, source and placement | [chart.md](inspector/chart.md) |
| A named range | One local name | [named-range.md](inspector/named-range.md) |
| A named style | Cell typography and format, edited once | [named-style.md](inspector/named-style.md) |
| A comment | One thread on a cell | [comment.md](inspector/comment.md) |
| Nothing | The spreadsheet itself | [spreadsheet.md](inspector/spreadsheet.md) |
| An avatar, a "who" link, a variable | *shared* | [`_shared/inspector`](../_shared/inspector/) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| The only one | The editor — a Univer grid, and what Icarus adds to it | [workspace.md](workspace.md) |

## The rules this screen keeps

**A cell's identity is its A1 address.** Rows and columns are not identified model
objects, which is why nothing in these panels offers a row or column lens.

**Icarus's formula engine is the only calculation authority.** Every formula reads
its inputs when it runs, so there is no cached result, no recalculation prompt,
and nothing stale.

**No formula bar.** Editing a formula happens in the cell or in the inspector.
That makes in-cell editing load-bearing, and gives long formulas a 320px panel to
live in.

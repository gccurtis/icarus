# Spreadsheet editor — panels

One spreadsheet: a sparse grid, not a workbook of sheets. No formula bar, no name
box, no toolbar — the inspector already names the cell you are on and holds the
formula in it.

One subscreen.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/spreadsheet.md) | The spreadsheet as a whole | This spreadsheet · Calculation · Saved · From template |
| [Variables](../../context/project/variables.md) | The project's named values | Actions · Search · Filters · Variables |
| [Named ranges](../../context/resource/named-ranges.md) | Names local to this spreadsheet | This spreadsheet |
| [Find](../../context/resource/find-sheet.md) | Search across values and formulas | Scope chips · Results |
| [Dependencies](../../context/resource/dependencies.md) | What the current cell reads and feeds, and what is broken | *n* reads · *n* feeds · Problems |
| [Objects](../../context/resource/objects.md) | Charts and overlays floating over the grid | One section per group |
| [Insert](../../context/resource/insert-sheet.md) | Putting something new in | Charts · Content · Structure |
| [Styles](../../context/resource/styles-sheet.md) | The named cell styles | Named styles |
| [Print](../../context/resource/print.md) | Getting a grid onto paper | Page setup · Area and repeats · Show |
| [Comments](../../context/resource/comments-sheet.md) | Conversation on cells | Scope chips · Open |
| [Context](../../context/resource/context-sheet.md) | What prompt blocks here can look up | Saved Contexts |

Project variables and this spreadsheet's named ranges are two separate views on
purpose. They are different scopes and must not be mistaken for one another.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A cell containing a formula | The formula, what it reads, what it feeds | [cell-with-formula.md](../../inspector/resource/cell-with-formula.md) |
| A cell containing a value | The value, its type, its format | [cell.md](../../inspector/resource/cell.md) |
| A cell in error | What broke and how to repair it | [error-cell.md](../../inspector/resource/error-cell.md) |
| A range | Shared formatting, aggregates, and range actions | [range.md](../../inspector/resource/range.md) |
| A spill child | Where the values came from, and why it is read-only | [spill.md](../../inspector/resource/spill.md) |
| A chart | Type, source and placement | [chart.md](../../inspector/resource/chart.md) |
| A named range | One local name | [named-range.md](../../inspector/resource/named-range.md) |
| A named style | Cell typography and format, edited once | [named-style-sheet.md](../../inspector/resource/named-style-sheet.md) |
| A comment | One thread, its anchor and its replies | [comment.md](../../inspector/collaboration/comment.md) |
| Nothing | The spreadsheet itself | [spreadsheet.md](../../inspector/resource/spreadsheet.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |
| A project variable | The one in Analysis, wherever a variable needs a lens | [variable.md](../../inspector/analysis/variable.md) |

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

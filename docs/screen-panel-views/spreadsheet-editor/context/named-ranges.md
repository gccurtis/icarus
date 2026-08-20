# Named ranges

| View | What it is for | Sections |
| --- | --- | --- |
| Named ranges | Names that mean something inside this spreadsheet only | This spreadsheet |

Deliberately separate from the project [Variables](../../_shared/context/variables.md)
view. Both are names you can write in a formula, and they resolve in different
scopes — putting them in one list would make that difference invisible.

## Layout

| 300px |
| --- |
| actions |
| this spreadsheet |
| this spreadsheet |
| this spreadsheet |

## This spreadsheet

Each name and the range it covers.

**Shows**

- `costModel` — A1:G6
- `eventLog` — A1:M4183
- `assumptions` — A1:C22

**Needs** — the spreadsheet's named-range table.

**Open** — a named range whose cells were deleted has no defined behaviour. It
either becomes `#REF!` wherever it is used, or it is repaired, and the model does
not say which.

## Panel furniture

**Name this range** in the action row, acting on the current selection.

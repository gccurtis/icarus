# A cell

| Selecting | What it is | Sections |
| --- | --- | --- |
| A cell containing a literal value | The cell: its address, its value, its format | Cell · Content · Format · Merge and spill |

## Layout

| 300px |
| --- |
| cell |
| cell |
| content |
| format |
| merge and spill |

## Cell

**Shows** — `Address · C3`, `Value · 318,400`, `Type · number`

A cell's identity is its A1 address. Rows and columns are not identified model
objects, which is why there is no row lens and no column lens anywhere on this
screen.

**Needs** — the address, value and type.

## Content

The raw content, editable, unformatted — `318400`, not `318,400`.

**Needs** — the stored cell content.

## Format

**Shows** — `Style · Currency`, `Alignment · Right`, `Value format · #,##0`

**Needs** — the style reference and value format.

## Merge and spill

Whether this cell is part of either. Starts collapsed, and says "not part of a
merge or spill range" rather than being empty.

**Needs** — merge membership and spill membership for the address.

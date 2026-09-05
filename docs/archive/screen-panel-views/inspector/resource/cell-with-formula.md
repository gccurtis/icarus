# A cell with a formula

| Selecting | What it is | Sections |
| --- | --- | --- |
| A cell containing a formula | The cell, its expression, what it reads and what it feeds, and how it is formatted | Cell · Formula · Reads · Feeds · Format |

The lens that replaces the formula bar. It carries more than a bar could: not
just the expression but its dependencies in both directions.

## Layout

| 300px |
| --- |
| cell |
| formula |
| formula |
| formula |
| reads |
| feeds |
| format |

## Cell

**Shows** — `Address · G3`, `Shows · 41.70`, `Type · number`

The distinction between what it *shows* and what it *is* matters: a formatted
number and its underlying value are different, and both belong here.

**Needs** — the address, the evaluated value and its type.

## Formula

The expression, editable, with room to breathe.

**Shows** — `=IF(E3=0,"",F3*1000000/E3)`

Edited here or in the cell. There is no separate formula bar taking a row off the
grid.

**Needs** — the stored formula.

**Open** — a long formula in a 320px panel needs wrapping, and probably syntax
colouring, to be readable. This is the cost of removing the bar and it has to be
paid here.

## Reads

What this formula depends on, with what each one is.

**Shows** — *E3* — 194,224 · spill child of E2; *F3* — 8.10

**Needs** — parsed references resolved to values and kinds.

## Feeds

What depends on this cell. Starts collapsed.

**Shows** — *G6* — `=AVERAGE(G2:G5)`

**Needs** — a reverse scan over formulas.

## Format

Starts collapsed.

**Shows** — `Style · Currency`, `Alignment · Right`, `Value format · #,##0.00`

**Needs** — the cell's style reference and its value format.

# The sort

| Selecting | What it is | Sections |
| --- | --- | --- |
| The row in Sort | What the result is ordered by | Sort by · Actions |

## Layout

| 300px |
| --- |
| sort by |
| sort by |
| actions |

## Sort by

The target and the direction. The target is what is on an axis, aggregation
included — never a bare source field, because sorting by `customerMinutes` when
the chart shows `sum of customerMinutes` means something different.

**Shows** — `Field · sum of customerMinutes`, `Direction · Low to high | **High to low**`

**Needs** — the sort's target placement and direction.

## Actions

**Remove**.

**Open** — only one sort is offered. Whether a second, as a tiebreak, is ever
wanted is undecided; the model would need an ordered list rather than a single
value.

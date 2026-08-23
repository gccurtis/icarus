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

The target and direction of one identified operation. It may reference a source
list, a formula, or the output of an earlier operation. That distinction matters:
sorting raw `customerMinutes` and sorting an aggregated sum are different
programs.

**Shows** — `Field · sum of customerMinutes`, `Direction · Low to high | **High to low**`

**Needs** — the sort operation's id, value reference, direction, and position in
the ordered pipeline.

## Actions

**Remove**.

Multiple sorts are representable as separate operations. Their order is
execution order, so a future tiebreak shorthand must compile to that same list
rather than create a parallel sorting model.

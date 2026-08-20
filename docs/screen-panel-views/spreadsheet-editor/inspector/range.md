# A range

| Selecting | What it is | Sections |
| --- | --- | --- |
| Several cells, selected together | The selection as a block: what it contains, what it shares, what it sums to | Range · Shared formatting · Aggregate · Actions · Empty coordinates |

## Layout

| 300px |
| --- |
| range |
| shared formatting |
| aggregate |
| actions |
| empty coordinates |

## Range

**Shows** — `A1 range · A1:G1`, `Cells with content · 7 of 7`

The second number matters on a sparse grid: a range can be large and almost
empty.

**Needs** — the selection bounds and a count of persisted cells inside them.

## Shared formatting

Where the selection agrees and where it does not. *Mixed* is a value and setting
over it applies to all.

**Shows** — `Style · Header`, `Alignment · Mixed`, `Fill · Mixed`

**Needs** — per-property comparison across the range.

## Aggregate

The numbers you would otherwise compute by hand. Starts collapsed.

**Shows** — `Count · 7`

**Needs** — sum, average, count and min/max over the numeric cells in the range.

**Open** — the status bar already shows sum, average and count for the selection.
Whether this section adds anything, or should carry the aggregates the bar cannot
fit, needs deciding.

## Actions

**Name this range**, **Merge**, **Clear**.

## Empty coordinates

Starts collapsed.

**Open** — formatting applies only to existing blocks. An empty cell has no
persisted block to store fill, border, alignment or value format on, so
formatting an empty range either does nothing or has to mint blocks for every
coordinate in it. Neither is obviously right and the model does not choose.

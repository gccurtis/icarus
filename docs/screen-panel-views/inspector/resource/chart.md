# A chart

| Selecting | What it is | Sections |
| --- | --- | --- |
| A chart in the Objects view | Its type, where its data comes from, and where it sits | Chart · Placement · Status |

## Layout

| 300px |
| --- |
| chart |
| chart |
| placement |
| status |

## Chart

**Shows** — `Type · Column`, `Source range · A1:C5`, `Title · Customer-minutes by substation`

**Needs** — chart type, source range and title.

## Placement

Where on the grid it floats. Starts collapsed.

**Shows** — `Anchor · E9`, `Size · 360 × 220 px`

**Needs** — anchor address and pixel size.

**Open** — the anchor is an address, so it moves when rows and columns are
inserted. It belongs in the structural-rebase contract.

## Status

**Shows** — stable chart id, data-mark count, and added-element count.

The frame uses the `chart` revision target. CAGR, axis, and text annotations use
`chartElement`, so editing an internal element is not the same conflict as
moving the floating object.

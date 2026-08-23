# An analytic chart

| Selecting | What it is | Sections |
| --- | --- | --- |
| An analytic component in the Objects view | Its analytic identity, nested chart, materialization, and surface placement | Analytic · Chart · Placement · Status |

## Layout

| 300px |
| --- |
| analytic |
| chart |
| placement |
| status |

## Analytic

**Shows** — saved analytic, output kind, and `ready` / `stale` / `error`
materialization state.

**Needs** — analytic ID, title, component kind, and materialization state.

## Chart

**Shows** — `Type · Column`, `Source range · A1:C5`, `Title · Customer-minutes by substation`

**Needs** — chart type, source provenance, title, and selected semantic part.

## Placement

Where on the grid it floats. Starts collapsed.

**Shows** — `Anchor · E9`, `Size · 360 × 220 px`

**Needs** — anchor address and pixel size.

**Open** — the anchor is an address, so it moves when rows and columns are
inserted. It belongs in the structural-rebase contract.

## Status

**Shows** — stable analytic/component/chart IDs, data-mark count, added-element
count, and unresolved analytic issue count.

The frame belongs to the spreadsheet's analytic reference. The computation uses
`analytic`, the reusable output uses `analyticComponent`, chart formatting uses
`chart`, and CAGR/reference/trend/text annotations use `chartElement`. Moving
the floating object is therefore not the same conflict as editing a join or an
internal chart element.

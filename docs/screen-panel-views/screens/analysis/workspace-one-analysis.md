# Analysis — one analytic

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | Present the reusable answer, then show the ordered program that made it | Screen header · Analytic component · Customization section |

## Layout

| 1fr |
| --- |
| screen header |
| analytic component |
| analytic component |
| customization section |
| customization section |

The component comes before its controls because it is the thing being presented.
The controls beneath it are an explanation of that answer rather than a second
visual workspace.

## Screen header

**Shows** — “Outage minutes by substation”, `Saved`, **Duplicate**.

**Needs** — the analytic title and save state.

## Analytic component

The exact `AnalyticComponent` used in a document block, slide, and spreadsheet
overlay.

**Shows** — the current interactive chart/table and “Showing 6 of 41 · limit
10.” If the definition becomes incomplete, the last complete output remains
visible with stale/error state.

**Needs** — `AnalyticModel.component`, materialization state, available size,
and shared semantic selection.

There is no page-specific chart projection and no type translation between this
screen and an embedded surface.

## Customization section

Two columns: a narrow vertical channel rail and a generous editing grid.

The rail is chart-specific. The current stacked bar exposes X, optional Y, Data,
and optional Labels. Pie would expose only Data and Labels; Bubble would add
Size.

The active grid shows:

- X: `substations`, projected through its `name` column, followed by a drop well
  for another Extend/Join input;
- Y: an honest optional-empty state;
- Labels: an optional custom-label list distinct from value labels;
- Data: the explicit outer bridge `substations.id = outageEvents.subId`, then
  filters, group, aggregate, sort, and limit in top-to-bottom execution order.

Every card opens the matching Inspector target. Variables can later drag into
the active channel, but the grid must retain the same keyboard Add path and the
same persisted list selector.

**Needs** — `AnalyticDataDefinition`, the chart-specific customization slot
contract, relation/match diagnostics, and stable issue IDs.

## Relationship behavior

A relationship is no longer an inferred banner below unrelated shelves. It is
an explicit `AnalyticBridge` in Data. If a dimension or measure source is not in
`data.from`, Data shows a `missing-bridge` issue and the component keeps the last
good materialization instead of silently guessing a join.

## Related

[Analysis screen specification](../../../screen-specs/analysis.md) ·
[Analytic system overview](../../../data-models/data/analytic-system-overview.md)

# The chart

| Selecting | What it is | Sections |
| --- | --- | --- |
| The chart itself, or a kind in the Chart view | How the reusable result is drawn | Kind · Title · Chart-specific geometry · Axes · Legend · Colours · Labels · Elements |

## Layout

| 300px |
| --- |
| kind |
| title |
| axes |
| axes |
| legend |
| colours |
| labels and elements |

## Kind

**Shows** — Table · **Bar** · Line · Area · Scatter · Bubble · Pie/Doughnut ·
Waterfall · Mekko · Funnel · Radar · Heatmap · Treemap

**Needs** — the discriminated `ChartModel.type` inside the analytic component.

## Title

The chart's title, editable, distinct from the analysis's title — one is what the
picture says, the other is what the saved thing is called.

**Shows** — `Customer-minutes by substation, 2026 storms`

**Needs** — a display title.

**Open** — two titles is one too many if nobody ever sets them differently. Worth
watching in review.

## Axes

**Shows** — `X label · Substation`, `Y label · Customer-minutes`, `Y starts at
zero · on`, `Stacked · off`

**Needs** — axis labels and the two flags on the display definition.

## Legend

Starts collapsed.

**Shows** — None · **Right** · Bottom

**Needs** — legend position.

## Colours

Starts collapsed.

**Shows** — four swatches from the theme.

**Needs** — a colour set, ideally the same one the deck theme uses so a chart
pasted into a slide is not a different palette.

## Labels and elements

Label modes are chart-specific and include a custom label carried by each datum.
Selectable elements are constrained by the visual grammar: bars and lines can
carry CAGR and axis lines, point charts can carry trend and axis lines, while a
pie accepts text annotations but no meaningless axis or CAGR line.

**Open** — tooltip content and provenance drill-through still need a persisted
contract. They should not be inferred from transient SVG geometry.

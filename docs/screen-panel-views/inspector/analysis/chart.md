# The chart

| Selecting | What it is | Sections |
| --- | --- | --- |
| The chart itself, or a kind in the Chart view | How the result is drawn: kind, title, axes, legend, colour | Kind · Title · Axes · Legend · Colours · Not yet modeled |

## Layout

| 300px |
| --- |
| kind |
| title |
| axes |
| axes |
| legend |
| colours |
| not yet modeled |

## Kind

**Shows** — Table · **Bar** · Line · Area · Scatter · Bubble · Pie/Doughnut ·
Waterfall · Mekko · Funnel · Radar · Heatmap · Treemap

**Needs** — the display kind on `AnalysisDefinition`.

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

## Not yet modeled

**Open** — colour, size, detail, label and tooltip are not persisted encodings in
`AnalysisDefinition`. The empty Colour zone the builder shows is a proposal, not
something that can be saved today.

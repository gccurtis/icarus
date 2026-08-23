# Chart

| View | What it is for | Sections |
| --- | --- | --- |
| Chart | What kind of picture to draw | The kinds |

A grid of kinds, as cards, because a chart kind is a shape.

## Layout

| 300px |
| --- |
| the kinds |
| the kinds |

*The kinds* is a grid of cards inside the region, three to a row — the one place
in a context panel where content is laid out across rather than down.

## The kinds

**Shows** — Table · Bar · Line · Area · Scatter · Bubble · Pie/Doughnut ·
Waterfall · Mekko · Funnel · Radar · Heatmap · Treemap

Table is the safe default: it needs no encoding decisions and can display any
result. Picking a kind that needs another field adds an empty drop zone for it
rather than failing — the screen asks for what is missing instead of refusing.

**Needs** — the chart kinds the renderer supports, and a minimum-field rule per
kind.

**Open** — those minimum-field rules are undefined. Without them, an empty zone
cannot appear only when it is genuinely needed, and either every zone is always
shown or none is.

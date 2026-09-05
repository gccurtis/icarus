# A bar chart

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The bar chart itself — its background, **Inspect the chart**, or clearing the mark selection | How a number becomes a height, and which bar is which colour | Crumbs · Actions · Shape · Scale · Bars · Series · Legend · What a bar chart needs |

**This is the bar chart, not the chart.** [chart.md](chart.md) decides which kind
is drawn at all and what the axes are called; this lens is only reached when bars
are on screen, and everything in it is about the bars.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.chartFor` | Capability | stacking, zero base, legend position, and the colour tokens |
| `capabilities.analysis.resultFor` | Capability | the measure columns, one series each, and the rows |
| `capabilities.analysis.placementsOn` | Capability | the placement behind each series |
| `analysisId` | Prop | which analysis, where a caller already knows |
| local edits | Prop | stacking, base and legend, because there is no definition to write them to |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| actions | `PanelButton` |
| shape | `PanelStats` · `PanelFields` |
| scale | `PanelSection` |
| bars | `PanelSection` |
| series | `PanelSection` |
| legend | `PanelSection` |
| what a bar chart needs | `PanelSection` |

## Crumbs

The analysis, then *Bar chart*.

## Actions

**Example** — **Chart settings**

### Structure

- `PanelButton` — in the pane's own `actions` snippet, into
  [the chart lens](chart.md)

## Shape

How many bars, and of what.

**Example** — `12` bars · `2` series · `6` groups; then Across "substations.name"
· Tallest `1,842,000` · Evaluated "4 minutes ago · 240 ms"

### Structure

- `PanelStats` — bars, series, groups, in that order
- `PanelFields` — Across, Tallest, Evaluated

### Behavior

Bars is groups × series, because that is the number a reader is actually looking
at — six substations and two measures is twelve marks, not six.

## Scale

Where the bars start.

**Example** — [x] Y starts at zero — "Bar heights are proportional to their
values, so they can be compared."

### Structure

- `PanelSection` *Scale* → `PanelToggle` — **Y starts at zero**
- `PanelNote` — what the current setting means for how the bars read, one
  sentence either way

### Behavior

**Zero-basing is a claim, not a formatting preference**, which is why it sits at
the top of this band with the consequence written next to it rather than behind a
disclosure.

## Bars

How several series share a group.

**Example** — [ ] Stacked · Orientation `Vertical` · Spacing `Comfortable`

### Structure

- `PanelSection` *Bars* → `PanelToggle` — **Stacked**
  - `PanelNote` — what stacking is doing here, or that one series has nothing to
    stack against
- `PanelChoice` ×2 — **Orientation** and **Spacing**
- `PanelNote` `tone="gap"`

### Behavior

Stacked and side by side answer different questions — a total, or a comparison.
With one series the toggle has nothing to act on and the note says so rather than
the control disappearing, because whether a chart *could* stack is part of what
this band is reporting.

## Series

The measures, one row each, in the result's order.

**Example** — *Customer-minutes* — `sum of customerMinutes` — drawn ·
*Events* — `count of events` — not drawn

### Structure

- `PanelSection` `flush` — one `PanelRow` per measure, with its colour swatch

### Props

**Colours are role tokens.** A chart pasted into a deck comes out in the deck's
palette instead of carrying four literal colours from another document, which is
why the swatches show token names.

### Behavior

Selecting a series opens [its placement](placement.md).

## Legend

Whether there is one, and where.

**Example** — `None` `Right` `Bottom`, with Right on

### Structure

- `PanelSection`, closed on arrival — `PanelFields` → a *Position* field holding
  a `PanelSelect`
- `PanelNote` — that two series and no legend leaves nothing on the chart saying
  which colour is which

### Behavior

*Starts collapsed.* *None* is offered because a single-series chart has nothing
to distinguish and a legend of one entry is a caption in the wrong place — and
the note is the other half of that, present only where turning it off has cost
the reader something.

## What a bar chart needs

The minimum the kind requires, stated rather than enforced.

**Example** — "A category on X and at least one number on Y."

### Structure

- `PanelSection`, closed on arrival — the requirement in a sentence

### Behavior

*Starts collapsed.* Chart-kind minimum-field rules are not modelled, so the band
says what the kind needs instead of a control refusing a state it cannot detect.

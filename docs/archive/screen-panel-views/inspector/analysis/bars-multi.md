# Several bars

| Selecting … | What it is | Sections |
| --- | --- | --- |
| More than one bar, shift-clicked or dragged across | The selection as a group: what they share, and what they come to | Crumbs · Selection · In common · Together · Actions |

**A multiple selection is a thing in its own right, not a list of things.** The
reason to open this panel is to change all of them at once, so the bands are the
properties they share — and a property they disagree on is drawn as *Mixed*
rather than as whichever member the panel happened to read first. Typing over
Mixed sets every member, which is the only honest way to edit three values
through one control.

The selection arrives as `at`: a comma-separated list of `row:series` pairs,
because a bar is a group and a series and neither identifies one alone.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | the members, as `row:series` pairs in `at` |
| `capabilities.analysis.resultFor` | Capability | each member's group, series and value |
| `capabilities.analysis.chartFor` | Capability | the colour tokens, one per series |
| `analysisId` · `at` | Prop | the analysis and the members, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| selection | `PanelSection` |
| in common | `PanelSection` |
| together | `PanelSection` |
| actions | `PanelSection` |

The panel's title is the count — *3 bars*.

## Crumbs

The analysis, then the count.

## Selection

The members, one row each.

**Example** — "Cedar Hill · Customer-minutes" · "Rockvale · Customer-minutes" ·
"Cedar Hill · Events"

### Structure

- `PanelSection` `flush` — one `PanelRow` per member, with a count

### Behavior

Selecting one opens [what is underneath it](mark.md).

## In common

The properties the selection shares, and the ones it does not.

**Example** — Series `Mixed` · Colour `Mixed` · Label "" · Summarised `Mixed`

### Structure

- `PanelSection` *In common* → `PanelFields` — **Series** and **Colour** as
  `PanelSelect`s, **Label** as editable text, **Summarised** as a plain field,
  each reading *Mixed* where the members disagree
- `PanelNote` — how many series the selection spans, or that a set took on all of
  them
- `PanelNote` `tone="gap"`

### Behavior

**Mixed is computed from the members, never assumed.** Setting a control that
reads Mixed sets every member; a panel that showed one member's answer for all of
them would silently overwrite values the reader never saw.

Colour follows the series, so two series is two colours — which is why a
two-series selection reads Mixed here and cannot be given one.

## Together

The figure the selection was made to get.

**Example** — `3,914,000` together · `1,842,000` largest · `312,000` smallest

### Structure

- `PanelSection` *Together* → `PanelStats` → `PanelStat` ×3 — together, largest,
  smallest
  - across two series, the same stats in two columns and without *together*
- `PanelNote` — why the total is missing, where it is

### Behavior

**Together is a band because it is why anyone shift-clicks bars.** Four bars
summing to two thirds of the chart is the answer someone was after.

**The total is dropped rather than printed when the members are summarised
differently**: customer-minutes and event counts do not add, and a combined
figure across them would be a number with no name. Largest and smallest survive,
because those two are still true across units.

## Actions

**Example** — **Filter to these** · **Exclude these**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` ×2 — a funnel and a
  ban, each titled with the members it names
- `PanelNote` — the rule the press would add, once one has been pressed

### Behavior

Neither writes. A selection is the natural place to state a rule from, and the
rule is written out in words rather than applied, because changing a definition
from a click on the picture has to be undoable in one step first.

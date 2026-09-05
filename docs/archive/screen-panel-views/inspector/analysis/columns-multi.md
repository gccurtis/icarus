# Several table columns

| Selecting … | What it is | Sections |
| --- | --- | --- |
| More than one column of a table chart | The selection as a group: what they share, and what can be set on all of them | Crumbs · Selection · Together · In common · Actions |

Selecting columns is comparing them and changing them at once. Both are answered
here; [the single lens](column.md) is one click away on any row.

The selection arrives as `at`: a comma-separated list of column keys.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | the members, as column keys in `at` |
| `capabilities.analysis.resultFor` | Capability | each member's role, label and values |
| `capabilities.analysis.placementsOn` | Capability | the placement behind each |
| `capabilities.analysis.aggregationsFor` | Capability | what each member's field type permits |
| `analysisId` · `at` | Prop | the analysis and the members, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| selection | `PanelSection` |
| together | `PanelStats` |
| in common | `PanelSection` |
| actions | `PanelSection` |

The panel's title is the count — *2 columns*.

## Selection

The members, one row each.

**Example** — *Customer-minutes* — `sum of customerMinutes` · *Events* — `count
of events`

### Structure

- `PanelSection` `flush` — one `PanelRow` per member, with a count

### Behavior

Selecting one opens [its placement](placement.md).

## Together

What kind of columns these are, as two figures.

**Example** — `2` measures · `1` group columns

### Structure

- `PanelStats` `columns={2}` → `PanelStat` ×2 — measures, and group columns

### Behavior

**Two counts and no total.** A selection of columns has no figure of its own:
adding a duration to a count would produce a number that looks authoritative and
means nothing, and there is no units check here that could tell the two apart. So
the region says what the selection is made of and stops.

The split is what the panel below it turns on — summarising applies to the
measures, and a group column names the rows rather than being summarised.

## In common

The properties the selection shares.

**Example** — Role `measure` · Summarise by `Mixed` · Align `Mixed`

### Structure

- `PanelSection` → `PanelFields` with a `PanelSelect` and a `PanelChoice`, each
  reading *Mixed* where the members disagree

### Behavior

**The offered aggregations are the intersection, not the union.** Three columns
of three types share only what all three permit, and offering Sum because one of
them is a number would set it on two that cannot take it.

**Mixed is computed from the members, never assumed from their number.**
Alignment differs here because it follows the role — names lead, figures trail —
and the panel says so rather than picking one and calling it the answer.

## Actions

**Example** — **Remove 3**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` `tone="danger"` —
  labelled with the count, so the press says how much it takes
- `PanelNote` — that removing these columns removes the placements that produced
  them

### Behavior

Removing them leaves nothing to inspect, so the panel falls back to
[the analysis](analysis.md).

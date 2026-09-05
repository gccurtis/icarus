# Labels

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The Labels button under the chart | What the picture says, and what is drawn at all | Crumbs · Actions · Show · Text · Series · Replace |

The only one of the four buttons that changes nothing about the numbers.
Everything here is about reading the picture, which is why it is last in the
strip and why it has toggles and fields where the others have selects.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.chartFor` | Capability | the chart title, the axis labels, the legend position |
| `capabilities.analysis.placementsOn` | Capability | the series, for their labels |
| `capabilities.analysis.resultFor` | Capability | the first few tick labels, so *Replace* is about something visible |
| `analysisId` | Prop | which analysis, where a caller already knows |
| local edits | Prop | every change here, because there is no definition to write them to |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| actions | `PanelButton` |
| show | `PanelSection` |
| text | `PanelSection` |
| series | `PanelSection` |
| replace | `PanelSection` |

## Crumbs

The analysis, then *Labels*.

## Actions

**Example** — **Revert**

### Structure

- `PanelButton` — **Revert**, back to what the definition holds

## Show

What is drawn.

**Example** — Chart title [x] · X label [x] · Y label [x] · Legend [x] `Right` ·
Value on each bar [ ] · Gridlines [x]

### Structure

- `PanelSection` *Show* → `PanelToggle` ×4 — chart title, X label, Y label,
  legend
  - `PanelFields` → a *Legend* field holding a `PanelSelect`, only while the
    legend is on
- `PanelToggle` ×2 — **Value on each bar** and **Gridlines**
- `PanelNote` `tone="gap"`

### Behavior

**A label toggle is the text going away, not a flag.** `ChartDisplay` holds
strings and a legend position; nothing in it says *hidden*. So switching a label
off empties it and switching it back on restores what was there — one value with
one meaning, rather than a flag and a string that can disagree about whether an
axis is labelled. What the text was before it was switched off is held here, so
switching back on returns the words you had just typed rather than the saved
ones.

**Value on each bar** and **Gridlines** are not persisted encodings at all. They
toggle, and the note says where they go: nowhere.

## Text

The three strings, as fields.

**Example** — Title "Outage minutes by substation" · X "Substation" · Y
"Customer-minutes"

### Structure

- `PanelSection` → `PanelFields` — one editable field per string

## Series

What each series is called on the chart.

**Example** — `sum of customerMinutes` → "Customer-minutes"

### Structure

- `PanelSection` — one field per placement, with a count

### Behavior

A series label is display only. The formula still reads the placement's own name,
and a reader matching the chart against the definition has to find the same name
in both.

## Replace

Find-and-replace over the text the chart draws.

**Example** — Find "Feeder " · With "" · **Replace in labels** — over ticks
"Feeder 12, Feeder 8, Cedar Hill"

### Structure

- `PanelSection` *Replace* → `PanelFields` → *Find* and *With*, each a
  `PanelInput` `mono`
- `PanelActions` → `PanelButton` — **Replace in labels**
- `PanelNote` — what the last press changed, once one has happened
- `PanelNote` — the sample of current tick labels the find runs against

### Behavior

**Replace acts on the labels, never on the data.** "Feeder 12" on the axis is a
value in `substations.name`, and rewriting it here would be a chart quietly
disagreeing with the table it came from.

An empty replacement deletes the found text rather than doing nothing, which is
what the placeholder says.

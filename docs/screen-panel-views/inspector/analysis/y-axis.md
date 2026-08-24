# Y — up

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The Y-Axis button under the chart | Everything that decides what gives the chart its height | Crumbs · Series · Select data · Create join · Sort · Set condition |

The same four bands as [X — across](x-axis.md), and deliberately so: an axis is
an axis, and two panels answering the same four questions in two shapes would be
two things to learn.

**Y is the axis that stacks.** X holds one field and Y holds a series each, so
this one opens on a list and asks which series the bands below are about. Writing
it as a single hidden subject would make the second series unreachable from the
button that owns it.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.placementsOn` | Capability | the series on Y, and what is on X |
| `capabilities.analysis.tablesIn` | Capability | every variable and its fields |
| `capabilities.analysis.relationship` | Capability | the inferred key, and the alternatives |
| `capabilities.analysis.sortIn` · `filtersIn` | Capability | the order, and the conditions on this variable |
| `analysisId` | Prop | which analysis, where a caller already knows |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| series | `PanelSection` |
| select data | `PanelSection` |
| create join | `PanelSection` |
| sort | `PanelSection` |
| set condition | `PanelSection` |

Everything under *series* is about the chosen series. Choosing another changes
what the four bands below are describing.

## Crumbs

The analysis, then *Y — up*.

## Series

Every measure on this axis, and which one the bands below are about.

**Example** — `sum of customerMinutes` — "Customer-minutes" · `count of events`
— "Events" · **Add a series**

### Structure

- `PanelSection` `flush` — one `PanelRow` per placement, the chosen one `active`
  - `PanelActions` → `PanelButton` — **Add a series**

### Behavior

**How a series is summarised is shown here and not set here.** `sum of` versus
`count of` is what [the Data button](data-button.md) decides; repeating the
control would give one value two owners and let them disagree.

Adding one states the offer rather than taking it. There is no definition to
append to.

## Select data

Which variable, and which of its fields, for the chosen series.

**Example** — From `outageEvents` · Field `customerMinutes` · Type `number` ·
Summarised `Sum`

### Structure

- `PanelSection` *Select data* → `PanelFields` — two `PanelSelect`s, then *Type*
  and *Summarised* as plain fields

### Props

*Summarised* reads **Each value** where the series has no aggregation. It is
stated here and set in [the Data button](data-button.md): repeating the control
would give one value two owners and let them disagree.

### Behavior

Changing the variable resets the field, for the reason
[X — across](x-axis.md) gives.

## Create join

How the measure's variable relates to the axis it is spread across.

**Example** — Match on `subId → id` · Keep rows `Matching` — "Matches 38 of 41
rows." — **Open the relationship**

### Behavior

Open only when two variables are in play. It is the same relationship X states:
one fact, offered wherever the question is being asked.

## Sort

Whether the result is ordered by this axis, and which way.

**Example** — [x] Order by this axis · By `Customer-minutes` · Direction `High to
low`

### Behavior

**The drawn measure is the one the sort names.** Y may hold several series and
the bars draw one — two aggregates five orders of magnitude apart would draw the
second as zero pixels tall — so changing the sort target changes which series has
a height. The others are named in the legend as not drawn.

## Set condition

Which rows this axis keeps.

**Example** — `customerMinutes ≥ 1000` — "11 of 41 kept"

### Behavior

Rows kept and rows in, as on X. Selecting a rule opens
[the filter lens](filter.md).

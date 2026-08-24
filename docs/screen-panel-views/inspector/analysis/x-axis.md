# X — across

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The X-Axis button under the chart | Everything that decides what the chart is spread across | Crumbs · Select data · Create join · Sort · Set condition |

Everything the button's grid on the plane offers, at full width. The grid is the
two or three moves someone makes constantly; this is the rest, with the
consequence of each written beside it.

**The axis is the subject, not the placement.** The strip has one button per
axis, so the lens it opens has to be about the axis — which field is on it is the
first thing the lens *asks*, not the thing it was opened on.
[placement.md](placement.md) is the other lens, for a field already placed.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.placementsOn` | Capability | what is on X, and what is on Y — the second decides whether a join is needed |
| `capabilities.analysis.tablesIn` | Capability | every variable and its fields |
| `capabilities.analysis.relationship` | Capability | the inferred key between the two variables, and the alternatives |
| `capabilities.analysis.sortIn` · `filtersIn` | Capability | the order, and the conditions on this variable |
| `analysisId` | Prop | which analysis, where a caller already knows |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| select data | `PanelSection` |
| create join | `PanelSection` |
| sort | `PanelSection` |
| set condition | `PanelSection` |

## Crumbs

The analysis, then *X — across*.

### Structure

- `PanelCrumbs` — the analysis, keyed to [its lens](analysis.md)

## Select data

Which variable, and which of its fields.

**Example** — From `substations` · Field `name` · Type `text`

### Structure

- `PanelSection` *Select data* → `PanelFields`
  - `PanelSelect` ×2 — the variable, then the field
  - a plain *Type* field — the field's type, stated rather than chosen

### Behavior

**Changing the variable resets the field.** A field name carried across from the
previous table names a column that is not there — and `name` exists on both of
these, which is exactly how that goes unnoticed.

**X holds one field.** Y is the axis that stacks several, and
[it says so itself](y-axis.md).

## Create join

How this axis relates to the variable the measure comes out of.

**Example** — Match on `subId → id` · Keep rows `Matching` — "Matches 38 of 41
rows." — **Open the relationship**

### Structure

- `PanelSection` *Create join*, open only when a join is needed
  - `PanelSelect` **Match on** and `PanelChoice` **Keep rows**
  - `PanelNote` — the match rate and what the door says about it
  - `PanelActions` → `PanelButton` — **Open the relationship**, into
    [the relationship lens](relationship.md)
  - `PanelNote` `tone="gap"`

### Behavior

**The band appears because of what is on the other axis.** Two variables in play
is what makes a join necessary, so switching the source above opens or closes it
rather than leaving a step to get through permanently.

The match is named as a guess, with its rate, because it is one — and the chart
is quietly wrong whenever the guess is.

## Sort

Whether the result is ordered by this axis, and which way.

**Example** — [x] Order this axis · By `Customer-minutes` · Direction `High to
low` — "The bars come back by Customer-minutes, high to low."

### Structure

- `PanelSection` *Sort* → `PanelToggle` **Order this axis**, then `PanelSelect`
  **By** and `PanelChoice` **Direction**
- `PanelNote` — the order in a sentence, or that nothing orders the groups

### Behavior

There is one sort in the definition, so this control and
[the Y one](y-axis.md) write to the same place. What the axis decides is which
fields are worth offering, not how many sorts there are.

## Set condition

Which rows this axis keeps.

**Example** — `region is Northwest` — "6 of 41 kept" · **Add condition**

### Structure

- `PanelSection` — the existing rules, then a field, an operator and a value
  - `PanelButton` — **Add condition**
  - `PanelNote` `tone="gap"`

### Behavior

Only the conditions on the variable this axis reads are listed; the rest belong
to another axis. Each carries rows kept and rows in, because a condition with no
visible effect is usually a mistake and one number cannot say so.

Selecting a rule opens [the filter lens](filter.md). Adding one states the rule
it would write rather than writing it: there is nothing to write to yet.

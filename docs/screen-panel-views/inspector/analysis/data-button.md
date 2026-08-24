# The Data button

| Selecting … | What it is | Sections |
| --- | --- | --- |
| The Data button under the chart | What is measured, and how it is collapsed | Crumbs · Measures · Select data · Select aggregation · Set condition |

**Data is the measure, and the measure is a field plus a way of collapsing it.**
That is the whole of the difference between this and the two axis lenses: an axis
decides what a bar stands for, and this decides how tall it is. It is also why
aggregation lives here and is only *shown* on [Y](y-axis.md).

Three bands rather than four: there is no join. What is measured comes out of one
variable by definition — the moment it comes out of two, the question is how they
relate, and that is an axis's problem.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which analysis, where the caller has not named one |
| `capabilities.analysis.placementsOn` | Capability | the measures already on Y |
| `capabilities.analysis.tablesIn` | Capability | every variable and its fields, and each field's type |
| `capabilities.analysis.aggregationsFor` | Capability | which summaries a field of that type admits |
| `capabilities.analysis.filtersIn` | Capability | the conditions on this variable |
| `capabilities.analysis.resultFor` | Capability | whether the chart is actually drawing this measure |
| `analysisId` | Prop | which analysis, where a caller already knows |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| measures | `PanelSection` |
| select data | `PanelSection` |
| select aggregation | `PanelSection` |
| set condition | `PanelSection` |

The panel's title is what the measure reads — `sum of customerMinutes` — and it
follows the controls rather than the stored definition.

## Crumbs

The analysis, then the measure.

## Measures

Every measure in the analysis, and which one this is.

**Example** — `sum of customerMinutes` — drawn · `count of events` — in the
result

### Structure

- `PanelSection` *Measures* `flush` — one `PanelRow` per measure, counted
  - `PanelActions` → `PanelButton` ×2 — **Add a measure**, and **Open as a
    placement** into [placement.md](placement.md)
  - `PanelNote` — the offer **Add a measure** would make, once it has been
    pressed

### Behavior

Selecting one opens [its placement](placement.md). A measure that is in the
definition but not in the result says so, because a control editing something the
chart is not drawing is the most confusing state this panel has.

## Select data

Which variable, and which of its fields.

**Example** — From `outageEvents` · Field `customerMinutes` · Type `number`

### Structure

- `PanelSection` *Select data* → `PanelFields` — two `PanelSelect`s, then *Type*
  as a plain field

### Behavior

Changing the field can make the current aggregation illegal, which is what the
band below handles rather than failing later.

## Select aggregation

How the values under one mark become one number.

**Example** — `Each value` `Sum` `Count` `Average` `Minimum` `Maximum`, with Sum
on

### Structure

- `PanelSection` → `PanelChoice` — the summaries this field's type admits
- `PanelNote` `tone="gap"`

### Behavior

**The permitted aggregations come from the field's type.** A text field cannot be
summed, so the set shrinks when the field changes rather than offering six
options and failing on four of them — and the chosen one is kept legal, because a
control showing a value its own set no longer contains is a control lying about
what will happen.

**What it reads is derived, not stored.** Changing the aggregation changes the
name of the column it produces, so the heading follows the control instead of
lagging a revision behind it.

## Set condition

Which rows the measure counts.

**Example** — `customerMinutes ≥ 1000` — "11 of 41 kept" · **Add condition**

### Behavior

A condition here applies before the aggregation, which is what makes it different
from one on an axis: the same rule in a different place gives a different number.
Selecting a rule opens [the filter lens](filter.md).

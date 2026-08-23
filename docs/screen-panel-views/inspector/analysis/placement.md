# A list in a dimension

| Selecting | What it is | Sections |
| --- | --- | --- |
| An input in X, Y, Labels, or Size | One table-to-list projection inside an ordered dimension | Source · Select a list · Composition · Dimension operations · Label · Actions |

This lens explains how one normalized table contributes a list to the visual.
X and Y use the same model; Labels and Size use it as well because they are
lists aligned to materialized rows even when they do not draw axes.

## Source

Shows the project variable and the normalized shape available to the analytic.
Naming the input matters because two variables can both have a `name` column.

**Shows** — `Input · outageEvents`, `Shape · 4,182 × 7 table`

**Needs** — the identified `AnalyticInput` and its resolved `FormulaValue`.

## Select a list

A table cannot silently become an axis. The user chooses any body column, any
data row, or a function whose lambda receives the complete normalized table and
returns a list. Column headers label columns and are not included in the values.

**Shows** — `Column · customerMinutes`, `Row · 3`, or `Function · formula-id`

**Needs** — `AnalyticListSelector` plus a preview of the resulting values.

## Composition

For every dimension input after the first, shows the ordered step that consumes
it. **Extend** stacks its list beneath the accumulated dimension. **Join** matches
the accumulated relation to the new input using explicit left and right keys and
chooses whether displayed values come from the left, right, or their coalesce.

**Needs** — the identified `AnalyticDimensionStep` and the bindings already
available above it.

## Dimension operations

Shows filter, group, sort, limit, and formula transformations in execution order.
Moving an operation changes meaning and must be one undoable definition edit.

## Label

An optional human label for the projected list. It does not replace the stable
input, binding, or selector identities.

## Actions

**Move within dimension**, **Move to another compatible slot**, **Remove**.
Moving across slots preserves the selector when compatible; it never silently
turns a grouped or transformed list into a data aggregation.

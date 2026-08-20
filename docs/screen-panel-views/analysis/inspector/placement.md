# A field on an axis

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in X or Y | One placement: which field, how it is summarised, what it is called on the chart | Field · Summarise by · Label · Actions |

The most common selection while building. A placement is a field plus a decision
about how to collapse it.

## Layout

| 300px |
| --- |
| field |
| summarise by |
| summarise by |
| label |
| actions |

## Field

Where the field came from and what it is. Naming the source variable matters:
two variables can both have a `name` column.

**Shows** — `From · outageEvents`, `Field · customerMinutes`, `Type · number`

**Needs** — the placement's source variable, field and inferred type.

## Summarise by

The aggregation. *Each value* means no aggregation at all, which is a real choice
and belongs in the same row as the others.

**Shows** — Each value · **Sum** · Count · Average · Minimum · Maximum

**Needs** — the aggregation set, filtered by what the field's type permits — a
text field cannot be summed.

## Label

What the axis says. Defaults from the field name, editable, because
`customerMinutes` is not what a chart should be labelled.

**Shows** — `Customer-minutes`

**Needs** — an optional label on the placement.

## Actions

**Move to X**, **Move to Filters**, **Remove**.

**Open** — moving an aggregated placement to Filters has no obvious meaning. Either
the aggregation is dropped, or the move is refused.

# Customization

| View | What it is for | Sections |
| --- | --- | --- |
| Customization | How source tables become the current visual | Chart-specific slots · Ordered operations |

The compact companion to the always-visible customization section. Its available
slots come from the current chart grammar rather than a universal shelf list:
pie exposes Data and Labels, while a bubble exposes X, Y, Data, Size, and optional
Labels.

X, Y, Labels, and Size accept lists. Dropping a table opens a selector for any
body column, any data row, or a function that returns a list. Data accepts a
relation and an ordered pipeline.

## Layout

| 300px |
| --- |
| slots supported by this visual |
| selected slot's inputs and selectors |
| extend / join steps |
| data relation / bridge |
| ordered operations |

## X — across

**Shows** — `substations.name`

**Needs** — the X dimension's identified inputs, list selectors, composition
steps, and ordered operations.

## Y — up

Y is structurally identical to X. Whether it draws a numeric axis, a second
category, or is unsupported is decided by the selected visual grammar.

**Shows** — `sum of customerMinutes`; `count of eventId`

**Needs** — the Y dimension when the selected output exposes one.

## Data program

**Shows** — the explicit input, dimension, or bridge in `data.from`, followed by
filter, group, aggregate, sort, limit, and formula operations in execution order.

**Needs** — the data relation, operations, and named outputs.

Every input, dimension, step, bridge, operation, and output has a stable id, so
the inspector, revisions, and future collaboration can address semantic objects
instead of array positions.

## Order is meaning

Filtering then sorting is not interchangeable with sorting then filtering. The
array order is therefore persisted execution order and is shown top to bottom.

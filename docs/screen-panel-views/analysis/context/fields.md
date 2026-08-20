# Fields

| View | What it is for | Sections |
| --- | --- | --- |
| Fields | Where each field has been put | X · Y · Filters · Sort · Limit |

The builder. Each section is a drop zone; each row is a placement that opens its
own lens.

The zones are named for what they do to the picture — *across*, *up* — rather than
for the query operation behind them.

## Layout

| 300px |
| --- |
| x — across |
| y — up |
| y — up |
| filters |
| sort |
| limit |

## X — across

**Shows** — `substations.name`

**Needs** — the analysis definition's X placement.

## Y — up

Several are allowed; each is a series.

**Shows** — `sum of customerMinutes`; `count of eventId`

**Needs** — the Y placements, each with a field and an aggregation.

## Filters

**Shows** — `eventDate ≥ 2026-01-01`

**Needs** — the definition's filter list.

**Open** — filters have no stable IDs in the model, so the UI cannot promise
durable selection or collaboration on an individual one.

## Sort

**Shows** — `sum of customerMinutes, high to low`

**Needs** — the sort target and direction. A sort targets what is on an axis,
aggregation included — never a bare source field.

**Open** — sorts have no stable IDs either.

## Limit

**Shows** — `top 10`

**Needs** — the limit value.

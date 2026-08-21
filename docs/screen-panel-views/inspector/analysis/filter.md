# A filter

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in Filters | One rule about which rows are kept | Filter · Effect · Actions · Types |

## Layout

| 300px |
| --- |
| filter |
| filter |
| effect |
| actions |
| types |

## Filter

The field, the comparison, and the value — phrased as *keep rows where*, so the
direction is never ambiguous.

**Shows**

| | |
| --- | --- |
| Field | `outageEvents.eventDate` |
| Keep rows where | is · is not · **≥** · ≤ · between |
| Value | `2026-01-01` |

**Needs** — the filter's field, operator and value.

## Effect

What it actually removed. A filter with no visible effect is usually a mistake.

**Shows** — "4,182 rows in, 2,904 kept."

**Needs** — row counts before and after this filter, from the evaluator.

**Open** — per-filter counts require evaluating with and without each one. Whether
that is affordable needs checking before the section is promised.

## Actions

**Remove**.

## Types

Starts collapsed.

**Open** — type-appropriate value controls — a date picker for a date, a range for
a number — wait on a column-schema and type-inference contract for heterogeneous
table values. Until then every value is typed as text.

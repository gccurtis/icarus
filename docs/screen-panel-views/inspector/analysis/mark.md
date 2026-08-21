# A mark

| Selecting | What it is | Sections |
| --- | --- | --- |
| A bar, point or slice on the chart | One mark: what it stands for, and the rows underneath it | This bar · Underneath · Actions |

The way from the picture back to the data. It is what makes a chart
investigable rather than decorative.

## Layout

| 300px |
| --- |
| this bar |
| this bar |
| underneath |
| actions |

## This bar

Every encoded value for this mark, named by what put it there.

**Shows**

| | |
| --- | --- |
| substations.name | Feeder 12 |
| sum of customerMinutes | 1,842,000 |
| count of eventId | 3 |

**Needs** — the result row behind the mark, keyed by placement.

## Underneath

The source rows that were aggregated into it — the answer to "which three
events".

**Shows** — *3 rows in outageEvents* — E-8841, E-8842, E-8877

**Needs** — the evaluator to retain, or be able to re-derive, the source rows per
group.

**Open** — this is a second query, not a property of the result. Whether it is
computed on selection or carried in the result changes what the evaluator has to
return.

## Actions

**Filter to this** adds a filter for this mark's value. **Exclude** adds its
negation.

**Open** — both mutate the definition from a click on the picture. That is the
right gesture and it needs to be undoable in one step.

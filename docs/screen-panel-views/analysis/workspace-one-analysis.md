# Analysis — one analysis

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | The chart, then the controls that made it | Screen header · Chart · Drop zones · Relationship |

The chart is centred at the top, before any control, because it is the thing
being made. Everything below it is how it got that way.

## Layout

| 1fr |
| --- |
| screen header |
| chart |
| chart |
| chart |
| drop zones |
| drop zones |
| relationship |

*Relationship* appears only when two variables are in play and need relating.

## Screen header

**Shows** — "Outage minutes by substation", `Saved`, **Duplicate**

**Needs** — the analysis title and save state.

## Chart

The picture, its title, the kind switcher, and the two honest captions under it.

**Shows** — the chart title; a row of kind chips with Bar active; bars with the
tallest selected; then "Generated from current data — the result itself is not
stored" on the left and "Showing 6 of 41 · limit 10" on the right.

Both captions matter. The first stops a chart being mistaken for a stored result;
the second stops a truncated view being mistaken for the whole.

**Needs** — the evaluated result, the display definition, and the limit with the
ungrouped total.

## Drop zones

Six zones in a responsive strip, each a place to put a field: X, Y, Filters, Sort,
Limit and Colour. An empty zone says what belongs in it rather than sitting blank.

**Shows** — `X — across` holding `substations.name`; `Y — up` holding two
aggregates; `Filters` holding one, plus "drop a field to filter by it"; `Sort`;
`Limit`; and `Colour` reading "this chart doesn't need one — drop a field to split
the bars".

Every zone also has an Add menu and a keyboard path. Nothing here is drag-only.

**Needs** — `AnalysisDefinition` axes, filters, sorts and limit. Colour is not a
persisted encoding; that zone is a proposal.

**Open** — chart-kind minimum-field rules are undefined, so a zone cannot yet
appear only when the chosen kind genuinely needs it.

## Relationship

A banner, present only when two variables are in play with no stated relationship
between them. It is a problem to solve, stated where the problem is — not a
modelling step in front of the chart.

**Shows** — "Two variables, no relationship" over "You dropped **substations.name**
and **outageEvents.customerMinutes**. They line up on **subId → id**, which is
what this chart is using. Change it, or pick a different pairing." — with **Change
the match**.

**Needs** — key inference between the two variables, with the chosen pair and the
alternatives.

**Open** — without a real key-inference contract this is a guess presented as a
fact, and the chart above it is silently wrong when the guess is wrong.

# Plot Demo

Lives at `src/lib/views/plot-demo/plot-demo.md`. Trees live in the concern
document linked below.

## Purpose

The hand-rolled SVG charts, at `/demo/plot`, and the thing they exist for:
being able to point at one bar.

A separate page from `/demo/analysis` deliberately. That one is the library
version and stays as the comparison — its remaining defects are the argument for
this one, and deleting the evidence would leave only an assertion.

## Why they are ours now

Measured on the library version, by driving the page and reading the DOM:

- stacked labels landed at the same y as one another — three numbers printed on
  top of each other;
- clustered labels sat up and to the right of their bars, colliding with the
  next bar, in muted ink over a saturated fill;
- a stack total anchored to the last series' band rather than the column;
- the pie ignored the theme entirely, because it reads colours only off `series`
  and fell through to a built-in scheme;
- and nothing could be selected at all.

Every one of those is the same thing: the components own their geometry and
their colour, and expose only the hooks their authors anticipated.

## Why SVG and not canvas

Canvas was considered and refused. Colours here come from custom properties so a
theme swap reaches the chart; on canvas each one becomes a JavaScript read.
`copy-chart.ts` produces a PNG by serializing the SVG, and that feature is built
on the DOM being inspectable. Hover and selection are ordinary events on real
elements rather than hit-testing done by hand. Labels stay text — selectable,
searchable, and reachable by a screen reader. Canvas wins on thousands of marks;
these have tens.

## The model

`chart-spec.ts` holds what a chart *is*, apart from how it is drawn, and
`settingsFor(type)` says which settings a type can even answer — so a pie is
offered no stacking mode rather than being offered one it ignores.

`layout.ts` turns a spec and a size into **marks**: one addressable rectangle per
bar or segment, each carrying where it is and what it means. Ids come from the
category and the series rather than from position, so sorting or filtering leaves
a selection pointing at the same things.

`chart-selection.svelte.ts` holds what is selected, and reports the selection's
*shape* — one mark, a whole column, a whole series, or an arbitrary handful —
because those afford different actions.

## Boundary

This view owns the sample rows and which controls are offered. It does not own
the charts, the layout maths, the spec or the selection, all of which live in
`unique-components/chart/`.

## Public Contract

- **Entry:** [`plot-demo.svelte`](plot-demo.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

- `$lib/unique-components/chart` — the spec, the marks and the selection
- `$lib/unique-components/panel` — the controls and the selection panel
- `$lib/unique-components/screen` — the surface

It reads no client model and calls no capability.

## Concerns

- [`components/`](components/components.md)

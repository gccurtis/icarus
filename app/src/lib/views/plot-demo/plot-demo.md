# Plot Demo

Lives at `src/lib/views/plot-demo/plot-demo.md`. Trees live in the concern
document linked below.

## Purpose

The native SVG chart system, at `/demo/plot`: twelve type-dispatched chart
models, selectable chart parts, type-specific added elements, and a draggable
frame.

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

`$json-store/types/data/chart.ts` holds the persisted discriminated union.
`chart-model.ts` creates and validates those objects and exposes the capability
matrix. The same discriminant decides which renderer, axes, legend semantics,
selectable mark, and additions are legal.

`layout.ts` and `layout-additional.ts` turn a model and size into **marks**:
one addressable shape per bar, segment, slice, point, bubble, waterfall step,
funnel stage, radar point, heatmap cell, or treemap tile. Its id is the persisted
datum id, so sorting, refreshing, and resizing leave a selection pointing at the
same fact.

`chart-selection.svelte.ts` holds what is selected, and reports the selection's
*shape*. Its targets include axes and added elements as well as data marks.

`chart-element.svelte` owns frame movement and resizing through dedicated
handles. It never treats the chart body as a drag handle, which preserves all
interactions inside the plot.

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

- `$lib/unique-components/chart` — model construction, renderer, frame, marks and selection
- `$lib/unique-components/panel` — the controls and the selection panel
- `$lib/unique-components/screen` — the surface

It reads no client model and calls no capability.

## Concerns

- [`components/`](components/components.md)

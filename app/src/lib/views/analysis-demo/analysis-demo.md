# Analysis Demo

Lives at `src/lib/views/analysis-demo/analysis-demo.md`. Trees live in the
concern document linked below.

## Purpose

The Analysis workspace, working, at `/demo/analysis`. A companion to
[`vocabulary`](../vocabulary/vocabulary.md) and a different kind of page: the
vocabulary shows shapes, and this shows one screen's worth of them connected to
each other.

It exists to answer a question a catalogue cannot. A chart component is judged on
what it does when the numbers move — when a series is added, when a category is
filtered out, when the kind changes underneath the same data — and none of that
survives a screenshot. So the table on this page *is* the data, and the chart is
downstream of it.

## What is being evaluated

- whether the chart follows the theme rather than carrying a palette;
- whether switching kind is a value change rather than a rewrite;
- whether a chart can leave the screen it was made on as an image;
- whether the editing vocabulary works in a table cell, which is the composition
  the Analysis screen actually needs.

## The library, and why

`layerchart`, MIT, Svelte 5 native, SVG. The licence is a requirement rather than
a preference — everything here has to be usable in a commercial product, which
rules out the copyleft options outright.

SVG decides more than it appears to. It means the chart is painted by the same
custom properties as the rest of the application, so a theme swap reaches it; and
it means the chart can be serialized, which is the entire basis of taking a
picture of it. A canvas chart can do neither.

Rejected: `chart.js` (MIT, canvas — unstyleable by tokens, unserializable),
`echarts` (Apache-2.0, its own theming system and a heavy bundle),
`@unovis/svelte` (Apache-2.0, peer range stops at Svelte 4),
`@observablehq/plot` (ISC, SVG, but renders a whole plot from a spec rather than
composing — the Marimekko needs the pieces).

The Marimekko is ours, in plain SVG, because no general library has one: columns
whose width is a second quantity are a different geometry rather than a bar chart
variant.

## Boundary

This view owns the sample rows, which controls are offered, and the claim that
the chart is downstream of the table. It does not own the chart components, which
live in `unique-components/chart/`, nor the palette, which is the styles
directory's.

## Public Contract

- **Entry:** [`analysis-demo.svelte`](analysis-demo.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

- `$lib/unique-components/chart` — the subject
- `$lib/unique-components/screen` — the surface around it
- `$lib/unique-components/panel` — the controls and the editable cells

It reads no client model and calls no capability. The data is an array held here,
and the page says so on itself rather than implying a backend.

## Concerns

- [`components/`](components/components.md)

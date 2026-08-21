# Chart system overview

This is the review guide for Icarus charts. Read it before the field-by-field
[chart model reference](chart.md) or the renderer code.

The system has one job: preserve the meaning and identity of a chart while many
surfaces render and manipulate it at different sizes. A spreadsheet, slide,
analysis canvas, inspector preview, export process, and AI operation should all
be able to address the same chart parts without sharing DOM state.

## The shortest useful mental model

A chart is not an image. It is:

1. an identified set of facts;
2. a declaration of how those facts map to visual channels;
3. a list of identified additions such as reference or growth lines; and
4. a renderer that derives disposable SVG geometry from those three things and
   the space offered by the owning surface.

```text
source provenance ─────┐
                       v
resolved identified data + chart-type declaration + added elements
                       |
                       v
              validate capability boundary
                       |
                       v
                  derive geometry
                       |
                       v
            native addressable SVG marks
                       |
                       v
       selection / inspector / revisions / comments
```

Only the declaration is persisted. Coordinates, paths, ticks, regression
coefficients, CAGR percentages, hover state, and DOM nodes are derived.

## The five layers

### 1. Fact layer

`ChartData` is the common fact space:

```ts
type ChartData = {
  categories: ChartCategory[];
  series: ChartSeries[];
  datums: ChartDatum[];
};
```

A datum belongs to one category and one series. Its `value` is always the
primary quantitative channel. Depending on chart type it becomes height, y,
radius, intensity, area, or funnel width.

Point charts add only the channels they genuinely require:

```ts
type ChartDatum = {
  id: string;
  categoryId: string;
  seriesId: string;
  value: number;
  x?: number;
  size?: number;
  style?: { color?: string; opacity?: number };
};
```

- Scatter requires `x`; `value` is y.
- Bubble additionally requires `size`.
- Every other current chart uses the category–series pair and `value`.

This is deliberately not a bag of arbitrary encoding properties. A new optional
channel earns a field only when a real chart family needs it and can validate
it.

### 2. Declaration layer

`ChartModel` is a discriminated union. The `type` selects both a renderer and a
capability boundary:

```ts
type ChartModel =
  | BarChartModel
  | PieChartModel
  | LineChartModel
  | AreaChartModel
  | ScatterChartModel
  | BubbleChartModel
  | WaterfallChartModel
  | MekkoChartModel
  | FunnelChartModel
  | RadarChartModel
  | HeatmapChartModel
  | TreemapChartModel;
```

Type-specific fields state meaningful choices: bar orientation and layout, line
curve, area stacking, bubble radii, waterfall totals, Mekko width semantics,
funnel neck, radar fill opacity, heatmap scale, or treemap gap.

### 3. Geometry layer

Pure layout functions consume a validated model and a size. They return boxes,
paths, ticks, bands, points, and other disposable geometry. Every shape carries
the persisted datum id that produced it.

Geometry can be recalculated on every resize because nothing else addresses it.
No selection stores “the third rectangle” or an SVG path.

### 4. Interaction layer

Selection targets semantic model parts:

```ts
type ChartSelectionTarget =
  | { kind: "chart"; chartId: string }
  | { kind: "datum"; chartId: string; datumId: string; categoryId: string; seriesId: string }
  | { kind: "category"; chartId: string; categoryId: string }
  | { kind: "series"; chartId: string; seriesId: string }
  | { kind: "axis"; chartId: string; axisId: string }
  | { kind: "element"; chartId: string; elementId: string };
```

That single vocabulary is used by marks, legends, axis labels, the selection
panel, formatting commands, and future comments or inspector lenses.

### 5. Surface layer

`ChartModel` has no x, y, width, or height. A surface supplies a `ChartFrame`.
A spreadsheet persists an anchor, offset, size, and optional z-index around the
model. A slide or analysis canvas can supply a different placement wrapper
without changing what the chart means.

The draggable host has a dedicated title-strip move handle and corner resize
handle. The chart body therefore keeps pointer events for marks and annotations.

## Chart families

The twelve types are easier to understand as families than as twelve unrelated
renderers.

| Family | Types | Primary visual grammar | Data requirement |
| --- | --- | --- | --- |
| categorical Cartesian | bar, line, area, waterfall | category position × quantitative value | category–series values |
| numeric Cartesian | scatter, bubble | x × y, optionally size | x and value; bubble also size |
| proportional | pie/doughnut, funnel, treemap | angle, width, or area | one non-negative series |
| composition | Mekko | category width × within-category share | non-negative category–series values |
| polar | radar | category angle × quantitative radius | at least three categories |
| matrix | heatmap | category × series, value as intensity | category–series matrix |

This grouping matters when extending the system. A new type should reuse a
family scale and selection grammar when it has the same semantics, but it should
not pretend to be a configuration of another type when the geometry means
something different. Mekko is not “stacked bar with a width option”; width is a
second quantitative encoding and therefore part of its model.

## Capability matrix

The same exhaustive function drives renderer and editing UI behavior.

| Type | Selectable mark | Axes | Legend selects | Addable elements |
| --- | --- | --- | --- | --- |
| bar | bar or stacked segment | category, value | series | CAGR, reference line, text |
| pie / doughnut | slice | none | category | text |
| line | point | category, value | series | CAGR, reference line, text |
| area | point | category, value | series | CAGR, reference line, text |
| scatter | point | x, y | series | trend, reference line, text |
| bubble | bubble | x, y | series | trend, reference line, text |
| waterfall | step | category, value | none | reference line, text |
| Mekko | segment | category, share | series | reference line, text |
| funnel | stage | none | category | text |
| radar | point | category spokes, value rings | series | text |
| heatmap | cell | category, series | none | text |
| treemap | tile | none | category | text |

Impossible operations are absent, not accepted and ignored. The TypeScript
element union prevents a pie from containing an axis or CAGR line; runtime
validation protects imported or stale persisted data at the same boundary.

## Mekko mental model

A standard Mekko answers two questions simultaneously:

1. how much of the whole belongs to each category; and
2. how that category is divided among series.

Category width encodes the first answer. Segment height inside the category
encodes the second. Segment area therefore encodes its share of the whole.

`widths` makes that choice explicit:

```ts
type MekkoWidths =
  | { kind: "total" }
  | { kind: "equal" }
  | { kind: "custom"; weights: { categoryId: string; value: number }[] };
```

- `total` is the standard share-of-share form.
- `equal` is available when only within-category composition matters.
- `custom` is for an independent denominator such as market population.

Custom weights reference category IDs. Labels or array positions are not
acceptable identity.

## Added elements are declarations

Added elements are persisted requests, not drawings.

- A CAGR line stores a series, two category IDs, and a year count. The current
  rate and endpoints are derived from current values.
- A trend line stores a series and regression method. Slope, intercept, and
  R-squared are derived from current points.
- A reference line stores an axis ID and a numeric or category position. Pixel
  endpoints are derived from the current scale.
- Text stores normalized viewport coordinates so resizing does not change its
  intended relative placement.

This is the same rule as formulas: persist the expression and inputs, not a
second stale copy of the result.

## Identity rules

The chart, categories, series, datums, axes, and elements each have stable IDs.

- IDs never contain an array position.
- `key` is source identity; `label` is presentation.
- Source refresh reconciles categories and series by key and datums by their
  category–series key pair.
- A matching refresh preserves datum ID and local style.
- A removed fact causes its selection target to be pruned.
- A reordered fact keeps its selection.

The SVG is a projection of these IDs, not a new identity domain.

## Source and resolved data

The persisted chart carries both:

- `source`: provenance for the next refresh; and
- `data`: the complete resolved render input.

This is intentional denormalization. It lets a chart render in a slide, export,
or inspector without synchronously traversing its source. Source adapters know
how to resolve spreadsheet ranges or analysis outputs. Renderers do not.

The refresh boundary is:

```text
source adapter -> ChartDataInput -> reconcileChartData -> persisted ChartData
```

That keeps spreadsheet A1 notation, query details, and missing-source recovery
out of every plot component.

## Component system

```text
ChartElement                         frame interaction
└── ChartRenderer                    validation, title, legend, type switch
    ├── PlotBars
    ├── PlotPie
    ├── PlotLines                    line + area family
    ├── PlotPoints                   scatter + bubble family
    ├── PlotWaterfall
    ├── PlotMekko
    ├── PlotFunnel
    ├── PlotRadar
    ├── PlotHeatmap
    └── PlotTreemap
```

The renderer is a total switch. Adding a union member without adding a renderer
becomes a visible type-checking task rather than a silent blank chart.

SVG is used because Icarus needs individual addressable marks, theme tokens,
accessible text, ordinary pointer events, and serialization for copy/export.
Canvas becomes attractive only when mark counts make DOM cost the dominant
constraint.

## System principles

### Persist meaning; derive pixels

Coordinates are a function of model plus available size. They are never stored
as chart truth.

### Identity belongs to facts, not views

A datum ID survives a renderer change, resize, sort, relabel, and value refresh.

### One discriminant owns legality

The model union, renderer switch, validator, and capability matrix agree on
`type`. Panels do not maintain a second chart taxonomy.

### Share fact infrastructure, not false geometry

All charts share categories, series, datums, IDs, source refresh, selection, and
formatting. Different visual grammars keep different layout functions.

### Derived analytics never go stale

CAGR and regression results are recalculated from current identified inputs.

### Interactions address semantic parts

Selection targets can be consumed by formatting, inspection, comments, and
revisions without retaining a DOM reference.

### Placement is a surface concern

Moving a chart is not a change to its data or visual declaration.

### Invalid charts fail before geometry

Missing point channels, illegal negative proportional values, broken references,
duplicate IDs, invalid domains, and unsupported elements produce model issues.
Layout code is not responsible for guessing repairs.

### Defaults are conveniences, not hidden semantics

Factories provide presentation defaults. Meaningful choices such as Mekko width
mode, waterfall totals, or CAGR periods remain explicit.

## How to extend the system

When adding a chart type:

1. Decide whether it is a new visual grammar or a configuration of an existing
   type.
2. State its required data channels and invariants.
3. Add a discriminated model whose element union permits only meaningful
   additions.
4. Add defaults in a creation function.
5. Add the type to the exhaustive capability matrix and axis enumerator.
6. Validate its channels, references, ranges, and type-specific constraints.
7. Write a pure layout function that carries persisted IDs onto every mark.
8. Write a native SVG plot component using semantic selection targets.
9. Add the renderer branch and a demo fixture.
10. Test model rejection, geometry, stable identity, and capability boundaries.

If a proposed type cannot answer steps two and seven clearly, its model is not
ready.

## Deliberate current boundaries

- Treemap V1 is flat; hierarchy is not implied by category order.
- Trend lines are linear. The model can add methods later without persisting
  coefficients.
- Pie, funnel, and treemap require one series.
- Radar uses non-negative radial values.
- Mekko uses non-negative segments.
- Chart source materialization is a separate adapter/mutation concern.
- Frame dragging and mark selection ship here; direct dragging of individual
  text annotations remains an editor interaction to add later.
- Very large mark sets may eventually need canvas or WebGL, but the persisted
  model and semantic selection vocabulary should remain unchanged.

## Review order

1. This overview: confirm mental models and system principles.
2. [Chart model reference](chart.md): confirm persisted fields and per-type
   constraints.
3. `chart-model.ts`: confirm factories, reconciliation, validation, and
   derived calculations.
4. `layout.ts` and `layout-additional.ts`: confirm pure geometry.
5. Plot components: confirm mark-level events and accessibility.
6. `chart-renderer.svelte`: confirm the total type switch and legend policy.
7. `chart-element.svelte`: confirm frame interaction stays outside the plot.
8. Unit tests and `/demo/plot`: exercise the complete system.

## File map

- Model contract:
  `app/src/lib/json-store/types/data/chart.ts`
- Construction and validation:
  `app/src/lib/unique-components/chart/chart-model.ts`
- Selection:
  `app/src/lib/unique-components/chart/chart-selection.svelte.ts`
- Existing bar/pie geometry:
  `app/src/lib/unique-components/chart/plot/layout.ts`
- Expanded family geometry:
  `app/src/lib/unique-components/chart/plot/layout-additional.ts`
- Renderer:
  `app/src/lib/unique-components/chart/chart-renderer.svelte`
- Draggable host:
  `app/src/lib/unique-components/chart/chart-element.svelte`
- Interactive review surface:
  `/demo/plot`

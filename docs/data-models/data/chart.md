# Chart model

A chart is the identified visual declaration nested in a reusable
`AnalyticComponentModel`. It carries resolved data so every surface can render
and interact with it, while the parent analytic definition owns joins,
filtering, grouping, sorting, aggregation, and custom formulas.

Read the [chart system overview](chart-system-overview.md) first for mental
models, principles, capability boundaries, and the recommended review order.
Read the parent [analytic system overview](analytic-system-overview.md) for the
data and surface boundaries.
The shipping TypeScript contract is
[`app/src/lib/json-store/types/data/chart.ts`](../../../app/src/lib/json-store/types/data/chart.ts).

## Shared contract

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

type ChartBase = {
  id: string;
  title?: string;
  source: ChartSource;
  data: ChartData;
  legend: ChartLegend;
  valueFormat?: ChartNumberFormat;
};
```

Every type adds fields that change its meaning or visual encoding. Coordinates,
SVG paths, ticks, hover state, calculated CAGR, and regression coefficients are
not model fields.

## Data

```ts
type ChartData = {
  categories: ChartCategory[];
  series: ChartSeries[];
  datums: ChartDatum[];
};

type ChartCategory = {
  id: string;
  key: string;
  label: string;
};

type ChartSeries = {
  id: string;
  key: string;
  label: string;
  color?: string;
  hidden?: boolean;
};

type ChartDatum = {
  id: string;
  categoryId: string;
  seriesId: string;
  value: number;
  x?: number;
  size?: number;
  label?: string;
  style?: { color?: string; opacity?: number };
};
```

There can be at most one datum for a category–series pair. `value` is the
primary quantitative channel. Scatter requires `x`; bubble requires both `x`
and `size`. `label` is the optional materialized custom Labels channel. Every
quantitative channel must be finite.

`key` is source identity and `label` is presentation. Refresh reconciliation
matches category and series keys, then their pair, preserving IDs and explicit
datum style when the same semantic fact remains.

## Source

```ts
type ChartSource =
  | { kind: "inline" }
  | {
      kind: "spreadsheet-range";
      resourceId: Id<"spreadsheets">;
      range: CellRange;
      seriesInColumns: boolean;
    }
  | { kind: "analysis"; analysisId: Id<"analyses"> };
```

The source records refresh provenance. It does not make renderers understand
spreadsheet ranges or analytic plans. `data` remains the complete materialized
render input; the parent analytic definition is the editable computation.

## Axes

```ts
type ChartAxis = {
  id: string;
  kind: "category" | "series" | "value" | "x" | "y";
  title?: string;
  visible: boolean;
  grid: boolean;
  domain?: [number, number];
  format?: ChartNumberFormat;
};
```

Categorical Cartesian and radar charts have category and value axes. Point
charts have x and y axes. A heatmap has category and series axes. Numeric domain
overrides must contain two ascending finite values.

Axes are identified because a person can select, inspect, format, comment on, or
attach a reference line to one.

## Added elements

```ts
type ChartElement =
  | ChartTextElement
  | ChartCagrLineElement
  | ChartAxisLineElement
  | ChartTrendLineElement;
```

Each chart member narrows its own `elements` array:

- bar, line, area: text, CAGR, or reference line;
- scatter, bubble: text, linear trend, or reference line;
- waterfall, Mekko: text or reference line;
- pie, funnel, radar, heatmap, treemap: text only.

### CAGR line

```ts
type ChartCagrLineElement = {
  id: string;
  kind: "cagr-line";
  seriesId: string;
  fromCategoryId: string;
  toCategoryId: string;
  periods: number;
  label?: string;
  showRate: boolean;
};
```

Both endpoints must be positive and ordered, and `periods` is explicit. Labels
are not parsed as dates. The rate is recalculated from current endpoint values.

### Reference line

```ts
type ChartAxisLineElement = {
  id: string;
  kind: "axis-line";
  axisId: string;
  position:
    | { kind: "value"; value: number }
    | { kind: "category"; categoryId: string };
  label?: string;
};
```

Numeric axes take a value position. Category axes take an identified category.

### Trend line

```ts
type ChartTrendLineElement = {
  id: string;
  kind: "trend-line";
  seriesId: string;
  method: "linear";
  showEquation: boolean;
  showRSquared: boolean;
  label?: string;
};
```

The declaration requires two or more points with distinct x values. Slope,
intercept, and R-squared are derived each render.

### Text

Text position is a pair of viewport fractions from zero to one. It remains
relative when a surface resizes the chart.

## Chart types

### Bar

```ts
type BarChartModel = ChartBase & {
  type: "bar";
  orientation: "vertical" | "horizontal";
  layout: "stack" | "group" | "expand" | "overlap";
  labels: "none" | "value" | "total" | "custom";
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};
```

`expand` normalizes each category to 100 percent. Both positive and negative
values are supported. New bars default to `stack`; a clustered bar is an
explicit `group` layout.

### Pie and doughnut

```ts
type PieChartModel = ChartBase & {
  type: "pie";
  labels: "none" | "value" | "percent" | "category" | "custom";
  innerRadius: number;
  elements: ChartTextElement[];
};
```

Exactly one series and non-negative values are required. `innerRadius` is zero
for a pie and positive, below 0.8, for a doughnut.

### Line

```ts
type LineChartModel = ChartBase & {
  type: "line";
  curve: "linear" | "smooth" | "step";
  points: "none" | "all";
  labels: "none" | "value" | "custom";
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};
```

Points remain interactive when their visible glyph is hidden.

### Area

```ts
type AreaChartModel = ChartBase & {
  type: "area";
  curve: "linear" | "smooth" | "step";
  layout: "overlap" | "stack" | "expand";
  labels: "none" | "value" | "custom";
  opacity: number;
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};
```

The selectable facts are points; the filled area is derived connective
geometry. `expand` normalizes each category.

### Scatter and bubble

```ts
type ScatterChartModel = ChartBase & {
  type: "scatter";
  labels: "none" | "category" | "value" | "custom";
  axes: NumericChartAxes;
  elements: PointChartElement[];
};

type BubbleChartModel = ChartBase & {
  type: "bubble";
  labels: "none" | "category" | "value" | "custom";
  radius: { min: number; max: number };
  axes: NumericChartAxes;
  elements: PointChartElement[];
};
```

Bubble radius scales with the square root of `size`, so perceived area rather
than radius represents the size channel.

### Waterfall

```ts
type WaterfallChartModel = ChartBase & {
  type: "waterfall";
  labels: "none" | "value" | "custom";
  totals: string[];
  colors: { increase: string; decrease: string; total: string };
  axes: CategoryChartAxes;
  elements: CartesianChartElement[];
};
```

Exactly one series is required. A category in `totals` is an absolute subtotal
drawn from zero; every other datum is a delta from the prior cursor.

### Mekko

```ts
type MekkoChartModel = ChartBase & {
  type: "mekko";
  labels: "none" | "value" | "percent" | "custom";
  widths:
    | { kind: "total" }
    | { kind: "equal" }
    | { kind: "custom"; weights: { categoryId: string; value: number }[] };
  gap: number;
  axes: CategoryChartAxes;
  elements: CartesianChartElement[];
};
```

Values and custom weights are non-negative. `gap` is a fraction of plot width.
With `total`, category width represents its total and segment height represents
within-category share, making segment area proportional to its whole-chart
share.

### Funnel

```ts
type FunnelChartModel = ChartBase & {
  type: "funnel";
  labels: "none" | "value" | "percent" | "category" | "custom";
  neck: number;
  elements: ChartTextElement[];
};
```

Exactly one non-negative series is required. `neck` is the fraction of the final
stage width retained at its lower edge.

### Radar

```ts
type RadarChartModel = ChartBase & {
  type: "radar";
  labels: "none" | "value" | "custom";
  fillOpacity: number;
  axes: CategoryChartAxes;
  elements: ChartTextElement[];
};
```

At least three categories and non-negative values are required. Category axes
render as spokes and the value axis as concentric rings.

### Heatmap

```ts
type HeatmapChartModel = ChartBase & {
  type: "heatmap";
  labels: "none" | "value" | "custom";
  scale: {
    domain?: [number, number];
    lowColor: string;
    highColor: string;
  };
  axes: MatrixChartAxes;
  elements: ChartTextElement[];
};
```

Categories are columns, series are rows, and value controls color intensity.

### Treemap

```ts
type TreemapChartModel = ChartBase & {
  type: "treemap";
  labels: "none" | "value" | "percent" | "category" | "custom";
  gap: number;
  elements: ChartTextElement[];
};
```

V1 is a flat, one-series, non-negative treemap. Categories are identified tiles.
Nested hierarchy is deliberately not inferred from ordering or labels.

## Placement

`ChartModel` has no placement fields. It is rendered through an
`AnalyticComponent`; a general surface may supply:

```ts
type ChartFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

A spreadsheet stores a live analytic reference alongside placement:

```ts
type SpreadsheetAnalytic = {
  id: string;
  analyticId: Id<"analyses">;
  anchor: { rowId: string; columnId: string };
  offset: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
};
```

This lets a frame move or resize without copying the chart or turning placement
into analytic content. Documents and slides use their native block/element
placement wrappers around the same component.

## Revisions

`analytic`, `analyticComponent`, `chart`, and `chartElement` are separate
operation targets. A data-pipeline edit, reusable-output replacement, chart
format edit, and CAGR/reference-line edit therefore do not become the same
conflict. Paths use stable IDs, for example
`analytics/#analytic-1/component/chart/elements/#element-4/label`.

## Related

[analytic system overview](analytic-system-overview.md) ·
[chart system overview](chart-system-overview.md) ·
[spreadsheet](../general-resources/spreadsheet.md) ·
[analysis](analysis.md) ·
[revision scheme](../revisions/README.md)

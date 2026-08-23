import type { CellRange } from "$json-store/types/content/formula-value";
import type { Id } from "$json-store/types/core/id";

/** A serializable number format. Functions never belong in persisted chart state. */
export type ChartNumberFormat =
  | {
      style: "number";
      compact?: boolean;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  | {
      style: "percent";
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  | {
      style: "currency";
      currency: string;
      compact?: boolean;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    };

/** Where the values came from. `data` below is always the resolved render input. */
export type ChartSource =
  | { kind: "inline" }
  | {
      kind: "spreadsheet-range";
      resourceId: Id<"spreadsheets">;
      range: CellRange;
      seriesInColumns: boolean;
    }
  | { kind: "analysis"; analysisId: Id<"analyses"> };

/** One ordered category. `key` is source identity; `label` is presentation. */
export type ChartCategory = {
  id: string;
  key: string;
  label: string;
};

/** One measure drawn consistently across categories or observations. */
export type ChartSeries = {
  id: string;
  key: string;
  label: string;
  color?: string;
  hidden?: boolean;
};

/**
 * One identified fact and the stable identity of its visual mark.
 *
 * `value` is the primary quantitative channel: height, radius, intensity, area,
 * or y. Point charts additionally require `x`; bubble charts also require
 * `size`. Keeping those channels on the fact means the same identity survives a
 * change from scatter to bubble without introducing a second data system.
 */
export type ChartDatum = {
  id: string;
  categoryId: string;
  seriesId: string;
  value: number;
  x?: number;
  size?: number;
  /** Optional data-channel label distinct from category, value, or share. */
  label?: string;
  /** A user override on this one mark. */
  style?: {
    color?: string;
    opacity?: number;
  };
};

/** Every value required to render the chart, with no table-shape assumptions. */
export type ChartData = {
  categories: ChartCategory[];
  series: ChartSeries[];
  datums: ChartDatum[];
};

export type ChartLegend = {
  visible: boolean;
  position: "start" | "end" | "top" | "bottom";
};

export type ChartAxisKind = "category" | "series" | "value" | "x" | "y";

export type ChartAxis = {
  id: string;
  kind: ChartAxisKind;
  title?: string;
  visible: boolean;
  grid: boolean;
  /** A deliberate numeric override. Absent derives the domain from data. */
  domain?: [number, number];
  format?: ChartNumberFormat;
};

export type CategoryChartAxes = {
  category: ChartAxis & { kind: "category" };
  value: ChartAxis & { kind: "value" };
};

export type NumericChartAxes = {
  x: ChartAxis & { kind: "x" };
  y: ChartAxis & { kind: "y" };
};

export type MatrixChartAxes = {
  category: ChartAxis & { kind: "category" };
  series: ChartAxis & { kind: "series" };
};

/** A free annotation, positioned as fractions of the complete chart viewport. */
export type ChartTextElement = {
  id: string;
  kind: "text";
  text: string;
  position: { x: number; y: number };
};

/**
 * A computed compound-growth annotation between two categories in one series.
 * The rate is derived every render and is never persisted stale beside the data.
 */
export type ChartCagrLineElement = {
  id: string;
  kind: "cagr-line";
  seriesId: string;
  fromCategoryId: string;
  toCategoryId: string;
  /** Number of years between endpoints; never inferred from arbitrary labels. */
  periods: number;
  label?: string;
  showRate: boolean;
};

/** A selectable reference line attached to one identified axis. */
export type ChartAxisLineElement = {
  id: string;
  kind: "axis-line";
  axisId: string;
  position:
    | { kind: "value"; value: number }
    | { kind: "category"; categoryId: string };
  label?: string;
};

/** A regression declaration. Coefficients remain derived from current points. */
export type ChartTrendLineElement = {
  id: string;
  kind: "trend-line";
  seriesId: string;
  method: "linear";
  showEquation: boolean;
  showRSquared: boolean;
  label?: string;
};

export type GrowthChartElement =
  | ChartTextElement
  | ChartCagrLineElement
  | ChartAxisLineElement;
export type CartesianChartElement = ChartTextElement | ChartAxisLineElement;
export type PointChartElement =
  | ChartTextElement
  | ChartAxisLineElement
  | ChartTrendLineElement;
export type AnnotationOnlyChartElement = ChartTextElement;
export type ChartElement =
  | ChartTextElement
  | ChartCagrLineElement
  | ChartAxisLineElement
  | ChartTrendLineElement;
export type ChartElementKind = ChartElement["kind"];

export type ChartBase = {
  id: string;
  title?: string;
  source: ChartSource;
  data: ChartData;
  legend: ChartLegend;
  valueFormat?: ChartNumberFormat;
};

export type BarChartModel = ChartBase & {
  type: "bar";
  orientation: "vertical" | "horizontal";
  layout: "stack" | "group" | "expand" | "overlap";
  labels: "none" | "value" | "total" | "custom";
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};

export type PieChartModel = ChartBase & {
  type: "pie";
  labels: "none" | "value" | "percent" | "category" | "custom";
  /** Zero is a pie. A positive fraction creates a doughnut without a new type. */
  innerRadius: number;
  elements: AnnotationOnlyChartElement[];
};

export type LineChartModel = ChartBase & {
  type: "line";
  curve: "linear" | "smooth" | "step";
  points: "none" | "all";
  labels: "none" | "value" | "custom";
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};

export type AreaChartModel = ChartBase & {
  type: "area";
  curve: "linear" | "smooth" | "step";
  layout: "overlap" | "stack" | "expand";
  labels: "none" | "value" | "custom";
  opacity: number;
  axes: CategoryChartAxes;
  elements: GrowthChartElement[];
};

export type ScatterChartModel = ChartBase & {
  type: "scatter";
  labels: "none" | "category" | "value" | "custom";
  axes: NumericChartAxes;
  elements: PointChartElement[];
};

export type BubbleChartModel = ChartBase & {
  type: "bubble";
  labels: "none" | "category" | "value" | "custom";
  radius: { min: number; max: number };
  axes: NumericChartAxes;
  elements: PointChartElement[];
};

export type WaterfallChartModel = ChartBase & {
  type: "waterfall";
  labels: "none" | "value" | "custom";
  /** Categories whose value is an absolute subtotal rather than a delta. */
  totals: string[];
  colors: { increase: string; decrease: string; total: string };
  axes: CategoryChartAxes;
  elements: CartesianChartElement[];
};

export type MekkoWidths =
  | { kind: "total" }
  | { kind: "equal" }
  | { kind: "custom"; weights: { categoryId: string; value: number }[] };

export type MekkoChartModel = ChartBase & {
  type: "mekko";
  labels: "none" | "value" | "percent" | "custom";
  /** Width and height are separate encodings; standard Mekko uses category totals. */
  widths: MekkoWidths;
  gap: number;
  axes: CategoryChartAxes;
  elements: CartesianChartElement[];
};

export type FunnelChartModel = ChartBase & {
  type: "funnel";
  labels: "none" | "value" | "percent" | "category" | "custom";
  /** Fraction of the final stage width retained at its lower edge. */
  neck: number;
  elements: AnnotationOnlyChartElement[];
};

export type RadarChartModel = ChartBase & {
  type: "radar";
  labels: "none" | "value" | "custom";
  fillOpacity: number;
  axes: CategoryChartAxes;
  elements: AnnotationOnlyChartElement[];
};

export type HeatmapChartModel = ChartBase & {
  type: "heatmap";
  labels: "none" | "value" | "custom";
  scale: {
    domain?: [number, number];
    lowColor: string;
    highColor: string;
  };
  axes: MatrixChartAxes;
  elements: AnnotationOnlyChartElement[];
};

/** V1 is a flat treemap; identified categories are the tiles. */
export type TreemapChartModel = ChartBase & {
  type: "treemap";
  labels: "none" | "value" | "percent" | "category" | "custom";
  gap: number;
  elements: AnnotationOnlyChartElement[];
};

/** The total switch consumed by the chart renderer. */
export type ChartModel =
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
export type ChartType = ChartModel["type"];

/**
 * Pixel geometry supplied by an owning surface to the draggable chart host.
 * Placement is deliberately outside `ChartModel`: the same chart can be placed
 * at different sizes without changing what it means.
 */
export type ChartFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

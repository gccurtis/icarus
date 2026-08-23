import type {
  AreaChartModel,
  BarChartModel,
  BubbleChartModel,
  CategoryChartAxes,
  ChartAxis,
  ChartAxisLineElement,
  ChartBase,
  ChartCagrLineElement,
  ChartData,
  ChartElement,
  ChartElementKind,
  ChartModel,
  ChartNumberFormat,
  ChartSource,
  ChartTextElement,
  ChartTrendLineElement,
  ChartType,
  FunnelChartModel,
  HeatmapChartModel,
  LineChartModel,
  MatrixChartAxes,
  MekkoChartModel,
  NumericChartAxes,
  PieChartModel,
  RadarChartModel,
  ScatterChartModel,
  TreemapChartModel,
  WaterfallChartModel
} from "$json-store/types/data/chart";

export type ChartIdKind = "chart" | "axis" | "category" | "series" | "datum" | "element";
export type ChartIdIssuer = (kind: ChartIdKind) => string;

/** The only default id issuer. Tests and importers inject a deterministic one. */
export const issueChartId: ChartIdIssuer = (kind) => `${kind}-${globalThis.crypto.randomUUID()}`;

export type ChartDataInput = {
  categories: readonly { id?: string; key: string; label?: string }[];
  series: readonly {
    id?: string;
    key: string;
    label?: string;
    color?: string;
    hidden?: boolean;
  }[];
  values: readonly {
    id?: string;
    categoryKey: string;
    seriesKey: string;
    value: number;
    x?: number;
    size?: number;
    label?: string;
    style?: { color?: string; opacity?: number };
  }[];
};

type CommonChartInput = {
  id?: string;
  title?: string;
  source?: ChartSource;
  data: ChartDataInput;
  legend?: Partial<ChartModel["legend"]>;
  valueFormat?: ChartNumberFormat;
};

type AxisInput = Partial<Omit<ChartAxis, "id" | "kind">>;
type CategoryAxesInput = { category?: AxisInput; value?: AxisInput };
type NumericAxesInput = { x?: AxisInput; y?: AxisInput };

export type BarChartInput = CommonChartInput & {
  orientation?: BarChartModel["orientation"];
  layout?: BarChartModel["layout"];
  labels?: BarChartModel["labels"];
  axes?: CategoryAxesInput;
};

export type PieChartInput = CommonChartInput & {
  labels?: PieChartModel["labels"];
  innerRadius?: number;
};

export type LineChartInput = CommonChartInput & {
  curve?: LineChartModel["curve"];
  points?: LineChartModel["points"];
  labels?: LineChartModel["labels"];
  axes?: CategoryAxesInput;
};

export type AreaChartInput = CommonChartInput & {
  curve?: AreaChartModel["curve"];
  layout?: AreaChartModel["layout"];
  labels?: AreaChartModel["labels"];
  opacity?: number;
  axes?: CategoryAxesInput;
};

export type ScatterChartInput = CommonChartInput & {
  labels?: ScatterChartModel["labels"];
  axes?: NumericAxesInput;
};

export type BubbleChartInput = CommonChartInput & {
  labels?: BubbleChartModel["labels"];
  radius?: Partial<BubbleChartModel["radius"]>;
  axes?: NumericAxesInput;
};

export type WaterfallChartInput = CommonChartInput & {
  labels?: WaterfallChartModel["labels"];
  totals?: readonly string[];
  colors?: Partial<WaterfallChartModel["colors"]>;
  axes?: CategoryAxesInput;
};

export type MekkoChartInput = CommonChartInput & {
  labels?: MekkoChartModel["labels"];
  widths?: MekkoChartModel["widths"];
  gap?: number;
  axes?: CategoryAxesInput;
};

export type FunnelChartInput = CommonChartInput & {
  labels?: FunnelChartModel["labels"];
  neck?: number;
};

export type RadarChartInput = CommonChartInput & {
  labels?: RadarChartModel["labels"];
  fillOpacity?: number;
  axes?: CategoryAxesInput;
};

export type HeatmapChartInput = CommonChartInput & {
  labels?: HeatmapChartModel["labels"];
  scale?: Partial<HeatmapChartModel["scale"]>;
  axes?: { category?: AxisInput; series?: AxisInput };
};

export type TreemapChartInput = CommonChartInput & {
  labels?: TreemapChartModel["labels"];
  gap?: number;
};

const duplicate = (values: readonly string[]) =>
  values.find((value, index) => values.indexOf(value) !== index);

const requireUnique = (label: string, values: readonly string[]) => {
  const repeated = duplicate(values);
  if (repeated !== undefined) throw new Error(`${label} '${repeated}' is duplicated`);
};

/** Turn source-shaped rows into the self-contained, identified render data. */
export const createChartData = (
  input: ChartDataInput,
  issueId: ChartIdIssuer = issueChartId
): ChartData => {
  requireUnique("category key", input.categories.map((entry) => entry.key));
  requireUnique("series key", input.series.map((entry) => entry.key));

  const categories = input.categories.map((entry) => ({
    id: entry.id ?? issueId("category"),
    key: entry.key,
    label: entry.label ?? entry.key
  }));
  const series = input.series.map((entry) => ({
    id: entry.id ?? issueId("series"),
    key: entry.key,
    label: entry.label ?? entry.key,
    ...(entry.color === undefined ? {} : { color: entry.color }),
    ...(entry.hidden === undefined ? {} : { hidden: entry.hidden })
  }));

  requireUnique("category id", categories.map((entry) => entry.id));
  requireUnique("series id", series.map((entry) => entry.id));

  const categoryByKey = new Map(categories.map((entry) => [entry.key, entry]));
  const seriesByKey = new Map(series.map((entry) => [entry.key, entry]));
  const pairKeys = input.values.map((entry) => `${entry.categoryKey}\u0000${entry.seriesKey}`);
  requireUnique("category/series value", pairKeys);

  const datums = input.values.map((entry) => {
    const category = categoryByKey.get(entry.categoryKey);
    const oneSeries = seriesByKey.get(entry.seriesKey);
    if (category === undefined) throw new Error(`unknown category key '${entry.categoryKey}'`);
    if (oneSeries === undefined) throw new Error(`unknown series key '${entry.seriesKey}'`);
    if (!Number.isFinite(entry.value)) {
      throw new Error(`value for '${entry.categoryKey}'/'${entry.seriesKey}' is not finite`);
    }
    if (entry.x !== undefined && !Number.isFinite(entry.x)) {
      throw new Error(`x for '${entry.categoryKey}'/'${entry.seriesKey}' is not finite`);
    }
    if (entry.size !== undefined && !Number.isFinite(entry.size)) {
      throw new Error(`size for '${entry.categoryKey}'/'${entry.seriesKey}' is not finite`);
    }

    return {
      id: entry.id ?? issueId("datum"),
      categoryId: category.id,
      seriesId: oneSeries.id,
      value: entry.value,
      ...(entry.x === undefined ? {} : { x: entry.x }),
      ...(entry.size === undefined ? {} : { size: entry.size }),
      ...(entry.label === undefined ? {} : { label: entry.label }),
      ...(entry.style === undefined ? {} : { style: entry.style })
    };
  });

  requireUnique("datum id", datums.map((entry) => entry.id));
  return { categories, series, datums };
};

/**
 * Resolve a fresh source result without re-identifying unchanged semantic data.
 * Category/series keys and their pair preserve previous ids and local styling.
 */
export const reconcileChartData = (
  previous: ChartData,
  input: ChartDataInput,
  issueId: ChartIdIssuer = issueChartId
): ChartData => {
  const categoryIdByKey = new Map(previous.categories.map((entry) => [entry.key, entry.id]));
  const seriesIdByKey = new Map(previous.series.map((entry) => [entry.key, entry.id]));
  const previousCategoryKey = new Map(previous.categories.map((entry) => [entry.id, entry.key]));
  const previousSeriesKey = new Map(previous.series.map((entry) => [entry.id, entry.key]));
  const datumIdByPair = new Map(
    previous.datums.flatMap((entry) => {
      const categoryKey = previousCategoryKey.get(entry.categoryId);
      const seriesKey = previousSeriesKey.get(entry.seriesId);
      return categoryKey === undefined || seriesKey === undefined
        ? []
        : [[`${categoryKey}\u0000${seriesKey}`, entry.id] as const];
    })
  );
  const datumStyleByPair = new Map(
    previous.datums.flatMap((entry) => {
      const categoryKey = previousCategoryKey.get(entry.categoryId);
      const seriesKey = previousSeriesKey.get(entry.seriesId);
      return categoryKey === undefined || seriesKey === undefined || entry.style === undefined
        ? []
        : [[`${categoryKey}\u0000${seriesKey}`, entry.style] as const];
    })
  );

  return createChartData(
    {
      categories: input.categories.map((entry) => ({
        ...entry,
        id: entry.id ?? categoryIdByKey.get(entry.key)
      })),
      series: input.series.map((entry) => ({
        ...entry,
        id: entry.id ?? seriesIdByKey.get(entry.key)
      })),
      values: input.values.map((entry) => ({
        ...entry,
        id: entry.id ?? datumIdByPair.get(`${entry.categoryKey}\u0000${entry.seriesKey}`),
        style:
          entry.style ?? datumStyleByPair.get(`${entry.categoryKey}\u0000${entry.seriesKey}`)
      }))
    },
    issueId
  );
};

const common = (input: CommonChartInput, issueId: ChartIdIssuer): ChartBase => ({
  id: input.id ?? issueId("chart"),
  ...(input.title === undefined ? {} : { title: input.title }),
  source: input.source ?? { kind: "inline" },
  data: createChartData(input.data, issueId),
  legend: {
    visible: input.legend?.visible ?? true,
    position: input.legend?.position ?? "bottom"
  },
  ...(input.valueFormat === undefined ? {} : { valueFormat: input.valueFormat })
});

const categoryAxes = (
  input: CategoryAxesInput | undefined,
  valueFormat: ChartNumberFormat | undefined,
  issueId: ChartIdIssuer
): CategoryChartAxes => ({
  category: {
    ...input?.category,
    id: issueId("axis"),
    kind: "category",
    visible: input?.category?.visible ?? true,
    grid: input?.category?.grid ?? false
  },
  value: {
    ...input?.value,
    id: issueId("axis"),
    kind: "value",
    visible: input?.value?.visible ?? true,
    grid: input?.value?.grid ?? true,
    ...(input?.value?.format !== undefined
      ? { format: input.value.format }
      : valueFormat === undefined
        ? {}
        : { format: valueFormat })
  }
});

const numericAxes = (
  input: NumericAxesInput | undefined,
  valueFormat: ChartNumberFormat | undefined,
  issueId: ChartIdIssuer
): NumericChartAxes => ({
  x: {
    ...input?.x,
    id: issueId("axis"),
    kind: "x",
    visible: input?.x?.visible ?? true,
    grid: input?.x?.grid ?? true
  },
  y: {
    ...input?.y,
    id: issueId("axis"),
    kind: "y",
    visible: input?.y?.visible ?? true,
    grid: input?.y?.grid ?? true,
    ...(input?.y?.format !== undefined
      ? { format: input.y.format }
      : valueFormat === undefined
        ? {}
        : { format: valueFormat })
  }
});

const matrixAxes = (
  input: HeatmapChartInput["axes"],
  issueId: ChartIdIssuer
): MatrixChartAxes => ({
  category: {
    ...input?.category,
    id: issueId("axis"),
    kind: "category",
    visible: input?.category?.visible ?? true,
    grid: input?.category?.grid ?? false
  },
  series: {
    ...input?.series,
    id: issueId("axis"),
    kind: "series",
    visible: input?.series?.visible ?? true,
    grid: input?.series?.grid ?? false
  }
});

export const createBarChart = (
  input: BarChartInput,
  issueId: ChartIdIssuer = issueChartId
): BarChartModel => {
  const base = common(input, issueId);
  const chart: BarChartModel = {
    ...base,
    type: "bar",
    orientation: input.orientation ?? "vertical",
    /** Stacked is the default comparison grammar; `group` is the explicit clustered variant. */
    layout: input.layout ?? "stack",
    labels: input.labels ?? "none",
    axes: categoryAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createPieChart = (
  input: PieChartInput,
  issueId: ChartIdIssuer = issueChartId
): PieChartModel => {
  const chart: PieChartModel = {
    ...common(input, issueId),
    type: "pie",
    labels: input.labels ?? "percent",
    innerRadius: input.innerRadius ?? 0,
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createLineChart = (
  input: LineChartInput,
  issueId: ChartIdIssuer = issueChartId
): LineChartModel => {
  const base = common(input, issueId);
  const chart: LineChartModel = {
    ...base,
    type: "line",
    curve: input.curve ?? "linear",
    points: input.points ?? "all",
    labels: input.labels ?? "none",
    axes: categoryAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createAreaChart = (
  input: AreaChartInput,
  issueId: ChartIdIssuer = issueChartId
): AreaChartModel => {
  const base = common(input, issueId);
  const chart: AreaChartModel = {
    ...base,
    type: "area",
    curve: input.curve ?? "linear",
    layout: input.layout ?? "overlap",
    labels: input.labels ?? "none",
    opacity: input.opacity ?? 0.24,
    axes: categoryAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createScatterChart = (
  input: ScatterChartInput,
  issueId: ChartIdIssuer = issueChartId
): ScatterChartModel => {
  const base = common(input, issueId);
  const chart: ScatterChartModel = {
    ...base,
    type: "scatter",
    labels: input.labels ?? "none",
    axes: numericAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createBubbleChart = (
  input: BubbleChartInput,
  issueId: ChartIdIssuer = issueChartId
): BubbleChartModel => {
  const base = common(input, issueId);
  const chart: BubbleChartModel = {
    ...base,
    type: "bubble",
    labels: input.labels ?? "none",
    radius: { min: input.radius?.min ?? 5, max: input.radius?.max ?? 24 },
    axes: numericAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createWaterfallChart = (
  input: WaterfallChartInput,
  issueId: ChartIdIssuer = issueChartId
): WaterfallChartModel => {
  const base = common({ ...input, legend: input.legend ?? { visible: false } }, issueId);
  const chart: WaterfallChartModel = {
    ...base,
    type: "waterfall",
    labels: input.labels ?? "value",
    totals: [...(input.totals ?? [])],
    colors: {
      increase: input.colors?.increase ?? "var(--token-color-success-fill)",
      decrease: input.colors?.decrease ?? "var(--token-color-danger-fill)",
      total: input.colors?.total ?? "var(--token-color-accent-1-fill)"
    },
    axes: categoryAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createMekkoChart = (
  input: MekkoChartInput,
  issueId: ChartIdIssuer = issueChartId
): MekkoChartModel => {
  const base = common(input, issueId);
  const chart: MekkoChartModel = {
    ...base,
    type: "mekko",
    labels: input.labels ?? "percent",
    widths: input.widths ?? { kind: "total" },
    gap: input.gap ?? 0.008,
    axes: categoryAxes(
      {
        ...input.axes,
        value: {
          ...input.axes?.value,
          format:
            input.axes?.value?.format ??
            ({ style: "percent", maximumFractionDigits: 0 } satisfies ChartNumberFormat)
        }
      },
      input.valueFormat,
      issueId
    ),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createFunnelChart = (
  input: FunnelChartInput,
  issueId: ChartIdIssuer = issueChartId
): FunnelChartModel => {
  const chart: FunnelChartModel = {
    ...common(input, issueId),
    type: "funnel",
    labels: input.labels ?? "percent",
    neck: input.neck ?? 0.5,
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createRadarChart = (
  input: RadarChartInput,
  issueId: ChartIdIssuer = issueChartId
): RadarChartModel => {
  const base = common(input, issueId);
  const chart: RadarChartModel = {
    ...base,
    type: "radar",
    labels: input.labels ?? "none",
    fillOpacity: input.fillOpacity ?? 0.18,
    axes: categoryAxes(input.axes, input.valueFormat, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createHeatmapChart = (
  input: HeatmapChartInput,
  issueId: ChartIdIssuer = issueChartId
): HeatmapChartModel => {
  const base = common({ ...input, legend: input.legend ?? { visible: false } }, issueId);
  const chart: HeatmapChartModel = {
    ...base,
    type: "heatmap",
    labels: input.labels ?? "value",
    scale: {
      ...(input.scale?.domain === undefined ? {} : { domain: input.scale.domain }),
      lowColor: input.scale?.lowColor ?? "var(--token-color-surface-canvas)",
      highColor: input.scale?.highColor ?? "var(--token-color-accent-1-fill)"
    },
    axes: matrixAxes(input.axes, issueId),
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export const createTreemapChart = (
  input: TreemapChartInput,
  issueId: ChartIdIssuer = issueChartId
): TreemapChartModel => {
  const chart: TreemapChartModel = {
    ...common(input, issueId),
    type: "treemap",
    labels: input.labels ?? "category",
    gap: input.gap ?? 0.006,
    elements: []
  };
  assertChartModel(chart);
  return chart;
};

export type ChartLegendDimension = "series" | "category" | "none";
export type ChartSelectableMark =
  | "bar"
  | "slice"
  | "point"
  | "bubble"
  | "step"
  | "segment"
  | "cell"
  | "tile";

export type ChartCapabilities = {
  axes: boolean;
  selectableMark: ChartSelectableMark;
  legendDimension: ChartLegendDimension;
  addableElements: readonly ChartElementKind[];
};

/** The renderer and every editing panel read the same type capability matrix. */
export const capabilitiesFor = (type: ChartType): ChartCapabilities => {
  switch (type) {
    case "bar":
      return {
        axes: true,
        selectableMark: "bar",
        legendDimension: "series",
        addableElements: ["cagr-line", "axis-line", "text"]
      };
    case "pie":
      return {
        axes: false,
        selectableMark: "slice",
        legendDimension: "category",
        addableElements: ["text"]
      };
    case "line":
    case "area":
      return {
        axes: true,
        selectableMark: "point",
        legendDimension: "series",
        addableElements: ["cagr-line", "axis-line", "text"]
      };
    case "scatter":
      return {
        axes: true,
        selectableMark: "point",
        legendDimension: "series",
        addableElements: ["trend-line", "axis-line", "text"]
      };
    case "bubble":
      return {
        axes: true,
        selectableMark: "bubble",
        legendDimension: "series",
        addableElements: ["trend-line", "axis-line", "text"]
      };
    case "waterfall":
      return {
        axes: true,
        selectableMark: "step",
        legendDimension: "none",
        addableElements: ["axis-line", "text"]
      };
    case "mekko":
      return {
        axes: true,
        selectableMark: "segment",
        legendDimension: "series",
        addableElements: ["axis-line", "text"]
      };
    case "funnel":
      return {
        axes: false,
        selectableMark: "step",
        legendDimension: "category",
        addableElements: ["text"]
      };
    case "radar":
      return {
        axes: true,
        selectableMark: "point",
        legendDimension: "series",
        addableElements: ["text"]
      };
    case "heatmap":
      return {
        axes: true,
        selectableMark: "cell",
        legendDimension: "none",
        addableElements: ["text"]
      };
    case "treemap":
      return {
        axes: false,
        selectableMark: "tile",
        legendDimension: "category",
        addableElements: ["text"]
      };
  }
};

/** All axes that can be selected or referenced, independent of chart family. */
export const chartAxes = (chart: ChartModel): readonly ChartAxis[] => {
  switch (chart.type) {
    case "bar":
    case "line":
    case "area":
    case "waterfall":
    case "mekko":
    case "radar":
      return [chart.axes.category, chart.axes.value];
    case "scatter":
    case "bubble":
      return [chart.axes.x, chart.axes.y];
    case "heatmap":
      return [chart.axes.category, chart.axes.series];
    case "pie":
    case "funnel":
    case "treemap":
      return [];
  }
};

const category = (chart: ChartModel, id: string) =>
  chart.data.categories.find((entry) => entry.id === id);
const series = (chart: ChartModel, id: string) =>
  chart.data.series.find((entry) => entry.id === id);
const datum = (chart: ChartModel, categoryId: string, seriesId: string) =>
  chart.data.datums.find(
    (entry) => entry.categoryId === categoryId && entry.seriesId === seriesId
  );

type GrowthChartModel = BarChartModel | LineChartModel | AreaChartModel;
type PointChartModel = ScatterChartModel | BubbleChartModel;

const isGrowthChart = (chart: ChartModel): chart is GrowthChartModel =>
  chart.type === "bar" || chart.type === "line" || chart.type === "area";
const isPointChart = (chart: ChartModel): chart is PointChartModel =>
  chart.type === "scatter" || chart.type === "bubble";

/** The current CAGR for an annotation, or undefined when compound growth is not real. */
export const cagrForLine = (
  chart: GrowthChartModel,
  line: Pick<
    ChartCagrLineElement,
    "seriesId" | "fromCategoryId" | "toCategoryId" | "periods"
  >
): number | undefined => {
  const fromIndex = chart.data.categories.findIndex((entry) => entry.id === line.fromCategoryId);
  const toIndex = chart.data.categories.findIndex((entry) => entry.id === line.toCategoryId);
  if (fromIndex < 0 || toIndex <= fromIndex || !Number.isFinite(line.periods) || line.periods <= 0) {
    return undefined;
  }

  const first = datum(chart, line.fromCategoryId, line.seriesId)?.value;
  const last = datum(chart, line.toCategoryId, line.seriesId)?.value;
  if (first === undefined || last === undefined || first <= 0 || last <= 0) return undefined;
  return Math.pow(last / first, 1 / line.periods) - 1;
};

export type ChartTrend = { slope: number; intercept: number; rSquared: number };

/** Linear regression derived from current points; no coefficient is persisted stale. */
export const trendForLine = (
  chart: PointChartModel,
  line: Pick<ChartTrendLineElement, "seriesId">
): ChartTrend | undefined => {
  const points = chart.data.datums.filter(
    (entry): entry is typeof entry & { x: number } =>
      entry.seriesId === line.seriesId && entry.x !== undefined && Number.isFinite(entry.x)
  );
  if (points.length < 2) return undefined;
  const xMean = points.reduce((sum, entry) => sum + entry.x, 0) / points.length;
  const yMean = points.reduce((sum, entry) => sum + entry.value, 0) / points.length;
  const xVariance = points.reduce((sum, entry) => sum + Math.pow(entry.x - xMean, 2), 0);
  if (xVariance === 0) return undefined;
  const slope =
    points.reduce((sum, entry) => sum + (entry.x - xMean) * (entry.value - yMean), 0) /
    xVariance;
  const intercept = yMean - slope * xMean;
  const total = points.reduce((sum, entry) => sum + Math.pow(entry.value - yMean, 2), 0);
  const residual = points.reduce(
    (sum, entry) => sum + Math.pow(entry.value - (slope * entry.x + intercept), 2),
    0
  );
  return { slope, intercept, rSquared: total === 0 ? 1 : 1 - residual / total };
};

const appendElement = <T extends ChartModel>(chart: T, element: ChartElement): T =>
  ({ ...chart, elements: [...(chart.elements as ChartElement[]), element] }) as T;

export const addCagrLine = (
  chart: ChartModel,
  input: Omit<ChartCagrLineElement, "id" | "kind">,
  issueId: ChartIdIssuer = issueChartId
): GrowthChartModel => {
  if (!isGrowthChart(chart)) {
    throw new Error("CAGR lines can only be added to bar, line, or area charts");
  }
  if (series(chart, input.seriesId) === undefined) throw new Error("the CAGR series does not exist");
  if (category(chart, input.fromCategoryId) === undefined) {
    throw new Error("the CAGR start category does not exist");
  }
  if (category(chart, input.toCategoryId) === undefined) {
    throw new Error("the CAGR end category does not exist");
  }
  const element: ChartCagrLineElement = {
    id: issueId("element"),
    kind: "cagr-line",
    ...input
  };
  if (cagrForLine(chart, element) === undefined) {
    throw new Error(
      "CAGR requires two ordered categories, a positive year span, and positive values"
    );
  }
  return appendElement(chart, element);
};

const axisPositionKind = (axis: ChartAxis): ChartAxisLineElement["position"]["kind"] =>
  axis.kind === "category" || axis.kind === "series" ? "category" : "value";

export const addAxisLine = (
  chart: ChartModel,
  input: Omit<ChartAxisLineElement, "id" | "kind">,
  issueId: ChartIdIssuer = issueChartId
): ChartModel => {
  if (!capabilitiesFor(chart.type).addableElements.includes("axis-line")) {
    throw new Error(`axis lines cannot be added to ${chart.type} charts`);
  }
  const axis = chartAxes(chart).find((entry) => entry.id === input.axisId);
  if (axis === undefined) throw new Error("the axis line's axis does not exist");
  const expected = axisPositionKind(axis);
  if (expected !== input.position.kind) {
    throw new Error(`a ${axis.kind} axis line needs a ${expected} position`);
  }
  if (
    input.position.kind === "category" &&
    category(chart, input.position.categoryId) === undefined
  ) {
    throw new Error("the axis line's category does not exist");
  }
  if (input.position.kind === "value" && !Number.isFinite(input.position.value)) {
    throw new Error("the axis line's value is not finite");
  }
  return appendElement(chart, { id: issueId("element"), kind: "axis-line", ...input });
};

export const addTrendLine = (
  chart: ChartModel,
  input: Omit<ChartTrendLineElement, "id" | "kind" | "method"> & { method?: "linear" },
  issueId: ChartIdIssuer = issueChartId
): PointChartModel => {
  if (!isPointChart(chart)) throw new Error("trend lines can only be added to scatter or bubble charts");
  if (series(chart, input.seriesId) === undefined) throw new Error("the trend series does not exist");
  const element: ChartTrendLineElement = {
    id: issueId("element"),
    kind: "trend-line",
    ...input,
    method: input.method ?? "linear"
  };
  if (trendForLine(chart, element) === undefined) {
    throw new Error("a trend line requires two or more points with distinct x values");
  }
  return appendElement(chart, element);
};

export const addChartText = <T extends ChartModel>(
  chart: T,
  input: Omit<ChartTextElement, "id" | "kind">,
  issueId: ChartIdIssuer = issueChartId
): T => {
  if (input.position.x < 0 || input.position.x > 1 || input.position.y < 0 || input.position.y > 1) {
    throw new Error("chart text positions are plot fractions between zero and one");
  }
  return appendElement(chart, { id: issueId("element"), kind: "text", ...input });
};

/** Remove identified annotations without touching data or frame placement. */
export const removeChartElements = <T extends ChartModel>(
  chart: T,
  elementIds: readonly string[]
): T => {
  const removed = new Set(elementIds);
  if (removed.size === 0) return chart;
  return {
    ...chart,
    elements: (chart.elements as ChartElement[]).filter((entry) => !removed.has(entry.id))
  } as T;
};

export type ChartDatumStylePatch = {
  color?: string | null;
  opacity?: number | null;
};

/** Apply one persisted visual edit to any identified set of chart marks. */
export const setChartDatumStyle = <T extends ChartModel>(
  chart: T,
  datumIds: readonly string[],
  patch: ChartDatumStylePatch
): T => {
  const wanted = new Set(datumIds);
  if (wanted.size === 0) return chart;
  for (const id of wanted) {
    if (!chart.data.datums.some((entry) => entry.id === id)) {
      throw new Error(`chart datum '${id}' does not exist`);
    }
  }
  if (
    patch.opacity !== undefined &&
    patch.opacity !== null &&
    (patch.opacity < 0 || patch.opacity > 1 || !Number.isFinite(patch.opacity))
  ) {
    throw new Error("chart datum opacity must be between zero and one");
  }

  const datums = chart.data.datums.map((entry) => {
    if (!wanted.has(entry.id)) return entry;
    const style = { ...entry.style };
    if (patch.color === null) delete style.color;
    else if (patch.color !== undefined) style.color = patch.color;
    if (patch.opacity === null) delete style.opacity;
    else if (patch.opacity !== undefined) style.opacity = patch.opacity;
    return {
      ...entry,
      ...(Object.keys(style).length === 0 ? { style: undefined } : { style })
    };
  });
  const next = { ...chart, data: { ...chart.data, datums } } as T;
  assertChartModel(next);
  return next;
};

export type ChartIssue = {
  code:
    | "duplicate-id"
    | "duplicate-key"
    | "missing-reference"
    | "invalid-value"
    | "invalid-axis"
    | "invalid-element"
    | "invalid-chart";
  path: string;
  message: string;
};

const validDomain = (domain: [number, number] | undefined) =>
  domain === undefined ||
  (Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[0] < domain[1]);

const oneSeries = (chart: ChartModel) => chart.data.series.length === 1;
const nonNegative = (chart: ChartModel) => chart.data.datums.every((entry) => entry.value >= 0);

/** Validate stored chart input before it reaches geometry or selection code. */
export const chartIssues = (chart: ChartModel): ChartIssue[] => {
  const issues: ChartIssue[] = [];
  const elements = chart.elements as ChartElement[];
  const axes = chartAxes(chart);
  const idPaths: { id: string; path: string }[] = [
    { id: chart.id, path: "id" },
    ...chart.data.categories.map((entry, index) => ({
      id: entry.id,
      path: `data.categories[${index}].id`
    })),
    ...chart.data.series.map((entry, index) => ({
      id: entry.id,
      path: `data.series[${index}].id`
    })),
    ...chart.data.datums.map((entry, index) => ({
      id: entry.id,
      path: `data.datums[${index}].id`
    })),
    ...axes.map((entry, index) => ({ id: entry.id, path: `axes[${index}].id` })),
    ...elements.map((entry, index) => ({ id: entry.id, path: `elements[${index}].id` }))
  ];

  const seen = new Map<string, string>();
  for (const entry of idPaths) {
    const first = seen.get(entry.id);
    if (first !== undefined) {
      issues.push({
        code: "duplicate-id",
        path: entry.path,
        message: `id '${entry.id}' is already used at ${first}`
      });
    } else seen.set(entry.id, entry.path);
  }

  const checkKeys = (name: string, values: readonly { key: string }[]) => {
    const repeated = duplicate(values.map((entry) => entry.key));
    if (repeated !== undefined) {
      issues.push({
        code: "duplicate-key",
        path: `data.${name}`,
        message: `'${repeated}' is duplicated`
      });
    }
  };
  checkKeys("categories", chart.data.categories);
  checkKeys("series", chart.data.series);

  const categoryIds = new Set(chart.data.categories.map((entry) => entry.id));
  const seriesIds = new Set(chart.data.series.map((entry) => entry.id));
  const repeatedPair = duplicate(
    chart.data.datums.map((entry) => `${entry.categoryId}\u0000${entry.seriesId}`)
  );
  if (repeatedPair !== undefined) {
    issues.push({
      code: "duplicate-key",
      path: "data.datums",
      message: "a chart can hold only one datum for each category/series pair"
    });
  }

  chart.data.datums.forEach((entry, index) => {
    if (!categoryIds.has(entry.categoryId) || !seriesIds.has(entry.seriesId)) {
      issues.push({
        code: "missing-reference",
        path: `data.datums[${index}]`,
        message: "datum categoryId and seriesId must resolve inside the chart"
      });
    }
    for (const [channel, value] of [
      ["value", entry.value],
      ["x", entry.x],
      ["size", entry.size]
    ] as const) {
      if (value !== undefined && !Number.isFinite(value)) {
        issues.push({
          code: "invalid-value",
          path: `data.datums[${index}].${channel}`,
          message: `chart ${channel} channels must be finite`
        });
      }
    }
    if (
      entry.style?.opacity !== undefined &&
      (!Number.isFinite(entry.style.opacity) || entry.style.opacity < 0 || entry.style.opacity > 1)
    ) {
      issues.push({
        code: "invalid-value",
        path: `data.datums[${index}].style.opacity`,
        message: "datum opacity must be between zero and one"
      });
    }
  });

  axes.forEach((axis) => {
    if ((axis.kind === "value" || axis.kind === "x" || axis.kind === "y") && !validDomain(axis.domain)) {
      issues.push({
        code: "invalid-axis",
        path: `axes.${axis.kind}.domain`,
        message: "a numeric-axis domain needs two ascending finite values"
      });
    }
  });

  const invalid = (path: string, message: string) =>
    issues.push({ code: "invalid-chart", path, message });
  switch (chart.type) {
    case "pie":
      if (!oneSeries(chart) || !nonNegative(chart) || chart.innerRadius < 0 || chart.innerRadius >= 0.8) {
        invalid(
          "data",
          "a pie needs exactly one series, non-negative values, and an inner radius from zero up to 0.8"
        );
      }
      break;
    case "scatter":
      if (chart.data.datums.some((entry) => entry.x === undefined)) {
        invalid("data.datums", "scatter points require an x channel");
      }
      break;
    case "bubble":
      if (
        chart.data.datums.some(
          (entry) => entry.x === undefined || entry.size === undefined || entry.size < 0
        ) ||
        chart.radius.min <= 0 ||
        chart.radius.max < chart.radius.min
      ) {
        invalid("data.datums", "bubble points require x and non-negative size channels with valid radii");
      }
      break;
    case "area":
      if (!Number.isFinite(chart.opacity) || chart.opacity < 0 || chart.opacity > 1) {
        invalid("opacity", "area opacity must be between zero and one");
      }
      break;
    case "waterfall":
      if (!oneSeries(chart)) invalid("data.series", "a waterfall requires exactly one series");
      if (chart.totals.some((id) => !categoryIds.has(id))) {
        invalid("totals", "waterfall subtotal category ids must resolve inside the chart");
      }
      break;
    case "mekko":
      if (!nonNegative(chart) || chart.gap < 0 || chart.gap >= 0.1) {
        invalid("data", "a Mekko requires non-negative values and a gap fraction below 0.1");
      }
      if (chart.widths.kind === "custom") {
        const ids = chart.widths.weights.map((entry) => entry.categoryId);
        if (
          duplicate(ids) !== undefined ||
          chart.widths.weights.some(
            (entry) =>
              !categoryIds.has(entry.categoryId) ||
              !Number.isFinite(entry.value) ||
              entry.value < 0
          ) ||
          chart.widths.weights.reduce((sum, entry) => sum + entry.value, 0) <= 0
        ) {
          invalid("widths", "custom Mekko weights must be unique, non-negative, finite, and identified");
        }
      }
      break;
    case "funnel":
      if (!oneSeries(chart) || !nonNegative(chart) || chart.neck < 0 || chart.neck > 1) {
        invalid("data", "a funnel needs one non-negative series and a neck fraction from zero to one");
      }
      break;
    case "radar":
      if (
        chart.data.categories.length < 3 ||
        !nonNegative(chart) ||
        chart.fillOpacity < 0 ||
        chart.fillOpacity > 1
      ) {
        invalid(
          "data.categories",
          "a radar needs at least three categories, non-negative values, and valid fill opacity"
        );
      }
      break;
    case "heatmap":
      if (!validDomain(chart.scale.domain)) {
        invalid("scale.domain", "a heatmap scale domain needs two ascending finite values");
      }
      break;
    case "treemap":
      if (!oneSeries(chart) || !nonNegative(chart) || chart.gap < 0 || chart.gap >= 0.05) {
        invalid("data", "a treemap needs one non-negative series and a gap fraction below 0.05");
      }
      break;
    case "bar":
    case "line":
      break;
  }

  const allowed = new Set(capabilitiesFor(chart.type).addableElements);
  const axisById = new Map(axes.map((axis) => [axis.id, axis]));
  elements.forEach((entry, index) => {
    if (!allowed.has(entry.kind)) {
      issues.push({
        code: "invalid-element",
        path: `elements[${index}]`,
        message: `${chart.type} charts cannot contain ${entry.kind} elements`
      });
      return;
    }
    if (entry.kind === "text") {
      if (
        entry.position.x < 0 ||
        entry.position.x > 1 ||
        entry.position.y < 0 ||
        entry.position.y > 1
      ) {
        issues.push({
          code: "invalid-element",
          path: `elements[${index}].position`,
          message: "text position must be inside the chart viewport"
        });
      }
      return;
    }
    if (entry.kind === "cagr-line") {
      if (
        !isGrowthChart(chart) ||
        !seriesIds.has(entry.seriesId) ||
        !categoryIds.has(entry.fromCategoryId) ||
        !categoryIds.has(entry.toCategoryId)
      ) {
        issues.push({
          code: "missing-reference",
          path: `elements[${index}]`,
          message: "CAGR line references must resolve inside a growth chart"
        });
      } else if (cagrForLine(chart, entry) === undefined) {
        issues.push({
          code: "invalid-element",
          path: `elements[${index}]`,
          message: "CAGR needs ordered categories, a positive year span, and positive endpoints"
        });
      }
      return;
    }
    if (entry.kind === "trend-line") {
      if (!isPointChart(chart) || !seriesIds.has(entry.seriesId)) {
        issues.push({
          code: "missing-reference",
          path: `elements[${index}].seriesId`,
          message: "trend-line series must resolve inside a point chart"
        });
      } else if (trendForLine(chart, entry) === undefined) {
        issues.push({
          code: "invalid-element",
          path: `elements[${index}]`,
          message: "a trend line requires distinct x values"
        });
      }
      return;
    }

    const axis = axisById.get(entry.axisId);
    if (axis === undefined) {
      issues.push({
        code: "missing-reference",
        path: `elements[${index}].axisId`,
        message: "axis line axisId must resolve inside the chart"
      });
    } else if (axisPositionKind(axis) !== entry.position.kind) {
      issues.push({
        code: "invalid-element",
        path: `elements[${index}].position`,
        message: `a ${axis.kind} axis line needs a ${axisPositionKind(axis)} position`
      });
    } else if (
      entry.position.kind === "category" &&
      !categoryIds.has(entry.position.categoryId)
    ) {
      issues.push({
        code: "missing-reference",
        path: `elements[${index}].position.categoryId`,
        message: "axis line categoryId must resolve inside the chart"
      });
    } else if (entry.position.kind === "value" && !Number.isFinite(entry.position.value)) {
      issues.push({
        code: "invalid-value",
        path: `elements[${index}].position.value`,
        message: "axis line values must be finite"
      });
    }
  });

  return issues;
};

export const assertChartModel = (chart: ChartModel): void => {
  const issues = chartIssues(chart);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
};

export const formatChartValue = (value: number, format?: ChartNumberFormat): string => {
  if (format === undefined) return value.toLocaleString();
  const shared = {
    minimumFractionDigits: format.minimumFractionDigits,
    maximumFractionDigits: format.maximumFractionDigits,
    notation:
      "compact" in format && format.compact ? ("compact" as const) : ("standard" as const)
  };
  if (format.style === "currency") {
    return new Intl.NumberFormat(undefined, {
      ...shared,
      style: "currency",
      currency: format.currency
    }).format(value);
  }
  if (format.style === "percent") {
    return new Intl.NumberFormat(undefined, { ...shared, style: "percent" }).format(value);
  }
  return new Intl.NumberFormat(undefined, shared).format(value);
};

/**
 * Charts.
 *
 * A family of its own because a chart belongs to neither of the other two: it is
 * drawn in a 300px inspector preview and across the whole plane of an Analysis
 * screen, at the same fidelity, from the same declaration.
 *
 * `ChartRenderer` and `ChartElement` are the native path: a serializable model,
 * hand-built SVG marks, semantic selection and a draggable frame. The legacy
 * `Chart` and `ChartMekko` remain temporarily for legacy comparison screens;
 * the model-backed Mekko is dispatched through `ChartRenderer`.
 */
export { default as Chart } from "./chart.svelte";
export { default as ChartElement } from "./chart-element.svelte";
export { default as ChartMekko } from "./chart-mekko.svelte";
export { default as ChartRenderer } from "./chart-renderer.svelte";
export { SERIES_COLORS, seriesColor } from "./palette";

/**
 * What a chart is, apart from how it is drawn — and what can be pointed at
 * inside one. A renderer is a function of a serializable model; the identified
 * marks it produces are what selection, annotation and per-element styling hang
 * from.
 */
export type {
  AnnotationOnlyChartElement,
  AreaChartModel,
  BarChartModel,
  BubbleChartModel,
  CartesianChartElement,
  CategoryChartAxes,
  ChartAxis,
  ChartAxisKind,
  ChartAxisLineElement,
  ChartBase,
  ChartCagrLineElement,
  ChartCategory,
  ChartData,
  ChartDatum,
  ChartElement as ChartModelElement,
  ChartElementKind,
  ChartFrame,
  ChartLegend,
  ChartModel,
  ChartNumberFormat,
  ChartSeries,
  ChartSource,
  ChartTextElement,
  ChartTrendLineElement,
  ChartType,
  FunnelChartModel,
  GrowthChartElement,
  HeatmapChartModel,
  LineChartModel,
  MatrixChartAxes,
  MekkoChartModel,
  MekkoWidths,
  NumericChartAxes,
  PieChartModel,
  PointChartElement,
  RadarChartModel,
  ScatterChartModel,
  TreemapChartModel,
  WaterfallChartModel
} from "$json-store/types/data/chart";
export {
  addAxisLine,
  addCagrLine,
  addChartText,
  addTrendLine,
  assertChartModel,
  capabilitiesFor,
  cagrForLine,
  chartAxes,
  chartIssues,
  createAreaChart,
  createBarChart,
  createBubbleChart,
  createChartData,
  createFunnelChart,
  createHeatmapChart,
  createLineChart,
  createMekkoChart,
  createPieChart,
  createRadarChart,
  createScatterChart,
  createTreemapChart,
  createWaterfallChart,
  formatChartValue,
  issueChartId,
  reconcileChartData,
  removeChartElements,
  setChartDatumStyle,
  trendForLine,
  type AreaChartInput,
  type BarChartInput,
  type BubbleChartInput,
  type ChartCapabilities,
  type ChartDataInput,
  type ChartDatumStylePatch,
  type ChartIdIssuer,
  type ChartIssue,
  type ChartLegendDimension,
  type ChartSelectableMark,
  type ChartTrend,
  type FunnelChartInput,
  type HeatmapChartInput,
  type LineChartInput,
  type MekkoChartInput,
  type PieChartInput,
  type RadarChartInput,
  type ScatterChartInput,
  type TreemapChartInput,
  type WaterfallChartInput
} from "./chart-model";
export type { ChartBand, ChartBox, ChartMark, ChartMarkKind } from "./chart-spec";
export {
  chartTargetKey,
  createChartSelection,
  type ChartSelection,
  type ChartSelectionShape,
  type ChartSelectionTarget
} from "./chart-selection.svelte";
export {
  DEFAULT_CHART_MINIMUM,
  frameForSpreadsheetAnalytic,
  moveChartFrame,
  resizeChartFrame,
  type ChartBounds,
  type ChartMinimum
} from "./frame";
export { default as ChartColors } from "./chart-colors.svelte";
export { default as ChartGrowth } from "./chart-growth.svelte";
export { chartToPng, copyChart } from "./copy-chart";
export { asPercent, cagr, elementOverElement } from "./growth";

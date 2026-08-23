/**
 * Charts we draw ourselves.
 *
 * Built because the library we were using owns its own geometry and colour and
 * exposes only the hooks its authors anticipated — measured, that meant three
 * stacked labels landing at the same y, clustered labels colliding with the next
 * bar, a total anchored to the wrong series, a pie in a palette that ignored the
 * theme, and no way at all to select one semantic mark across chart families.
 *
 * Everything here is SVG rather than canvas, deliberately: SVG paints from the
 * same custom properties as the rest of the application so a theme swap reaches
 * it, it serializes so a chart can be copied as an image, and its marks are real
 * elements so selection and hover are ordinary events rather than hit-testing.
 *
 * Geometry lives in `layout.ts` and `layout-additional.ts` as pure functions
 * over numbers, so it can be checked by reading it — exactly what could not be
 * done with geometry sealed inside somebody else's components.
 */
export { default as PlotBars } from "./plot-bars.svelte";
export { default as PlotFunnel } from "./plot-funnel.svelte";
export { default as PlotHeatmap } from "./plot-heatmap.svelte";
export { default as PlotLines } from "./plot-lines.svelte";
export { default as PlotMekko } from "./plot-mekko.svelte";
export { default as PlotPie } from "./plot-pie.svelte";
export { default as PlotPoints } from "./plot-points.svelte";
export { default as PlotRadar } from "./plot-radar.svelte";
export { default as PlotTreemap } from "./plot-treemap.svelte";
export { default as PlotWaterfall } from "./plot-waterfall.svelte";
export {
  layoutBars,
  layoutPie,
  lineForAxisElement,
  lineForCagr,
  placeTotalLabels,
  placeValueLabels,
  ticksFor,
  niceDomain,
  ticksIn,
  type BarLayoutResult,
  type BarLayout,
  type Box,
  type ChartLineGeometry,
  type LaidOut,
  type PieLayoutResult,
  type PlacedLabel,
  type PlotSize
} from "./layout";
export {
  cagrForCategorySeries,
  layoutCategorySeries,
  layoutFunnel,
  layoutHeatmap,
  layoutMekko,
  layoutPoints,
  layoutRadar,
  layoutTreemap,
  layoutWaterfall,
  lineForCategoryAxis,
  lineForNumericAxis,
  lineForTrend,
  type CategorySeriesLayout,
  type FunnelLayout,
  type HeatmapLayout,
  type MekkoLayout,
  type PointLayout,
  type RadarLayout,
  type SeriesPath,
  type TreemapLayout,
  type WaterfallLayout
} from "./layout-additional";

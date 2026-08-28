/**
 * Charts.
 *
 * A family of its own because a chart belongs to neither of the other two: it is
 * drawn in a 300px inspector preview and across the whole plane of an Analysis
 * screen, at the same fidelity, from the same declaration.
 *
 * **`layerchart` underneath — MIT, Svelte 5 native, SVG.** The licence is a
 * requirement rather than a preference: everything here has to be usable in a
 * commercial product, which rules out the copyleft options outright. SVG is the
 * other requirement, and it decides more than it looks like it does — an SVG
 * chart is styled by the same custom properties as the rest of the application,
 * so it follows a theme rather than carrying a palette of its own, and it can be
 * serialized, which is the whole basis of taking a picture of it.
 *
 * Considered and rejected: `chart.js` (MIT, but canvas — a canvas chart cannot
 * be styled by tokens and cannot be serialized), `echarts` (Apache-2.0, but its
 * own theming system and a large bundle), `@unovis/svelte` (Apache-2.0, but its
 * peer range stops at Svelte 4), `@observablehq/plot` (ISC, SVG, but it renders
 * a whole plot from a spec rather than composing, which the Marimekko needs).
 */
export { default as Chart } from "$authored-components/chart/chart.svelte";
export { default as ChartMekko } from "$authored-components/chart/chart-mekko.svelte";
export { SERIES_COLORS, seriesColor } from "$authored-components/chart/palette";

/**
 * What a chart is, apart from how it is drawn — and what can be pointed at
 * inside one. A renderer is a function of a spec; a spec is savable, templatable
 * and comparable, and the marks it produces are what selection, annotation and
 * per-element styling all hang from.
 */
export {
  markId,
  readMarkId,
  settingsFor,
  type AxisSpec,
  type ChartSettings,
  type ChartSpec,
  type ChartType,
  type LabelMode,
  type Mark,
  type MarkKind,
  type Orientation,
  type SeriesLayout,
  type SeriesSpec
} from "$authored-components/chart/chart-spec";
export { createChartSelection, type ChartSelection } from "$authored-components/chart/chart-selection.svelte";
export { default as ChartColors } from "$authored-components/chart/chart-colors.svelte";
export { default as ChartGrowth } from "$authored-components/chart/chart-growth.svelte";
export { chartToPng, copyChart } from "$authored-components/chart/copy-chart";
export { asPercent, cagr, elementOverElement } from "$authored-components/chart/growth";

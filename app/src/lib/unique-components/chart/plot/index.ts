/**
 * Charts we draw ourselves.
 *
 * Built because the library we were using owns its own geometry and colour and
 * exposes only the hooks its authors anticipated — measured, that meant three
 * stacked labels landing at the same y, clustered labels colliding with the next
 * bar, a total anchored to the wrong series, a pie in a palette that ignored the
 * theme, and no way at all to select a single bar or slice.
 *
 * Everything here is SVG rather than canvas, deliberately: SVG paints from the
 * same custom properties as the rest of the application so a theme swap reaches
 * it, it serializes so a chart can be copied as an image, and its marks are real
 * elements so selection and hover are ordinary events rather than hit-testing.
 *
 * The geometry lives in `layout.ts` as pure functions over numbers, so it can be
 * checked by reading it — which is exactly what could not be done with the
 * geometry sealed inside somebody else's components.
 */
export { default as PlotBars } from "./plot-bars.svelte";
export { default as PlotPie } from "./plot-pie.svelte";
export {
  layoutBars,
  layoutPie,
  placeTotalLabels,
  placeValueLabels,
  ticksFor,
  type BarLayout,
  type Box,
  type LaidOut,
  type PlacedLabel,
  type PlotSize
} from "./layout";

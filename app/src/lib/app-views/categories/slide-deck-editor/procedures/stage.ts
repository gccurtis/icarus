import type { AspectRatio, Frame, SlideDeckBody } from "$representation/data/types/slide-decks/body";

export type { Frame } from "$representation/data/types/slide-decks/body";

export type Size = { readonly width: number; readonly height: number };

export type Pixels = { x: number; y: number; width: number; height: number };

export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";

export const figures = (held: Size): string =>
  `${held.width.toFixed(2)} × ${held.height.toFixed(2)}`;

export const pixels = (held: Size): string =>
  `${Math.round(held.width)} × ${Math.round(held.height)}`;

/**
 * The slide's own coordinate space. A slide has no physical size — it is a
 * ratio and nothing else — so its height is a declared number of units and its
 * width follows from the ratio. Style sizes are in these units too, which is
 * what keeps a deck free of any print constraint.
 */
export const SLIDE_UNITS_HIGH = 720;

const RATIO: Record<AspectRatio, number> = { "16:9": 16 / 9, "4:3": 4 / 3 };

const SLIDE_WIDTH_REM = 52;
const AVERAGE_GLYPH_WIDTH_EM = 0.52;

export const MINIMUM_ZOOM = 50;
export const MAXIMUM_ZOOM = 200;

export const ZOOM_STEP = 5;

export const clampZoom = (zoom: number): number =>
  Math.min(Math.max(Math.round(zoom), MINIMUM_ZOOM), MAXIMUM_ZOOM);

export const percent = (zoom: number): string => `${Math.round(zoom)}%`;

/**
 * What is left either side of the slide, in rem. The gutter is scenery, so it
 * gives way before the slide does.
 */
export const MAXIMUM_GUTTER = 2.5;
export const MINIMUM_GUTTER = 0.75;

/** The largest a slide can be drawn on a surface this wide without it scrolling sideways. */
export const fitZoom = (available: number): number =>
  clampZoom(Math.floor(((available - MINIMUM_GUTTER * 2) / SLIDE_WIDTH_REM) * 100));

export const gutterOf = (available: number, drawnWidth: number): number =>
  Math.min(MAXIMUM_GUTTER, Math.max(MINIMUM_GUTTER, (available - drawnWidth) / 2));

export const cssRatio = (aspectRatio: AspectRatio): string => aspectRatio.replace(":", " / ");

export const ratioOf = (aspectRatio: AspectRatio): number => RATIO[aspectRatio];

export const slideUnits = (aspectRatio: AspectRatio): Size => ({
  width: SLIDE_UNITS_HIGH * RATIO[aspectRatio],
  height: SLIDE_UNITS_HIGH
});

export const charactersPerLine = (widthUnits: number, fontSize: number): number =>
  Math.max(1, Math.floor(widthUnits / (fontSize * AVERAGE_GLYPH_WIDTH_EM)));

export const toPixels = (frame: Frame, stage: Size): Pixels => ({
  x: frame.x * stage.width,
  y: frame.y * stage.height,
  width: frame.width * stage.width,
  height: frame.height * stage.height
});

export const toFrame = (held: Pixels, stage: Size): Frame => ({
  x: held.x / stage.width,
  y: held.y / stage.height,
  width: held.width / stage.width,
  height: held.height / stage.height
});

export const stageMetrics = (body: SlideDeckBody | undefined, zoom: number | null = 100) => {
  const ratio = body?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const units = slideUnits(ratio);

  const shown = clampZoom(zoom ?? 100);
  const at = shown / 100;
  const slideHeight = SLIDE_WIDTH_REM / RATIO[ratio];

  const styles = body?.styles;
  const fontSize = styles?.styles[styles.defaultKey]?.fontSize ?? 20;

  return {
    ratio,
    units,
    zoom: shown,
    slideWidth: SLIDE_WIDTH_REM,
    slideHeight,
    drawn: { width: SLIDE_WIDTH_REM * at, height: slideHeight * at },
    fontSize,
    charactersPerLine: charactersPerLine(units.width, fontSize)
  };
};

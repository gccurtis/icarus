import type { AspectRatio, Frame, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { StageSettings } from "$model/client/slide-deck-runtimes";

export type { Frame } from "$representation/data/types/slide-decks/body";
export type { StageSettings } from "$model/client/slide-deck-runtimes";

export type Size = { readonly width: number; readonly height: number };

export type Pixels = { x: number; y: number; width: number; height: number };

export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";

export const figures = (held: Size): string =>
  `${held.width.toFixed(2)} × ${held.height.toFixed(2)}`;

export const pixels = (held: Size): string =>
  `${Math.round(held.width)} × ${Math.round(held.height)}`;

const RATIO: Record<AspectRatio, number> = { "16:9": 16 / 9, "4:3": 4 / 3 };

export const clampZoom = (zoom: number, stage: StageSettings): number =>
  Math.min(Math.max(Math.round(zoom), stage.minimumZoom), stage.maximumZoom);

export const percent = (zoom: number): string => `${Math.round(zoom)}%`;

/** The largest a slide can be drawn on a surface this wide without it scrolling sideways. */
export const fitZoom = (available: number, stage: StageSettings): number =>
  clampZoom(
    Math.floor(((available - stage.minimumGutterRem * 2) / stage.widthRem) * 100),
    stage
  );

export const gutterOf = (available: number, drawnWidth: number, stage: StageSettings): number =>
  Math.min(
    stage.maximumGutterRem,
    Math.max(stage.minimumGutterRem, (available - drawnWidth) / 2)
  );

export const cssRatio = (aspectRatio: AspectRatio): string => aspectRatio.replace(":", " / ");

export const ratioOf = (aspectRatio: AspectRatio): number => RATIO[aspectRatio];

export const slideUnits = (aspectRatio: AspectRatio, stage: StageSettings): Size => ({
  width: stage.unitsHigh * RATIO[aspectRatio],
  height: stage.unitsHigh
});

export const charactersPerLine = (
  widthUnits: number,
  fontSize: number,
  stage: StageSettings
): number => Math.max(1, Math.floor(widthUnits / (fontSize * stage.averageGlyphWidthEm)));

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

export const stageMetrics = (
  body: SlideDeckBody | undefined,
  zoom: number | null,
  stage: StageSettings
) => {
  const ratio = body?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const units = slideUnits(ratio, stage);

  const shown = clampZoom(zoom ?? 100, stage);
  const at = shown / 100;
  const slideHeight = stage.widthRem / RATIO[ratio];

  const styles = body?.styles;
  const fontSize = styles?.styles[styles.defaultKey]?.fontSize ?? 20;

  return {
    ratio,
    units,
    zoom: shown,
    slideWidth: stage.widthRem,
    slideHeight,
    drawn: { width: stage.widthRem * at, height: slideHeight * at },
    fontSize,
    charactersPerLine: charactersPerLine(units.width, fontSize, stage)
  };
};

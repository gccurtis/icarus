import type { AspectRatio, Frame } from "$representation/data/types/presentations/body";
import type { StageSettings } from "$model/client/presentation-runtimes";

export type { Frame } from "$representation/data/types/presentations/body";
export type { StageSettings } from "$model/client/presentation-runtimes";

export type Size = { readonly width: number; readonly height: number };

export type Pixels = { x: number; y: number; width: number; height: number };

export type Ratio = { readonly width: number; readonly height: number };

export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";

export const ratioParts = (aspectRatio: AspectRatio): Ratio => {
  const [width, height] = aspectRatio.split(":").map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : { width: 16, height: 9 };
};

export const asAspectRatio = (width: number, height: number): AspectRatio =>
  `${Math.max(1, Math.round(width))}:${Math.max(1, Math.round(height))}`;

export const ratioOf = (aspectRatio: AspectRatio): number => {
  const held = ratioParts(aspectRatio);
  return held.width / held.height;
};

export const cssRatio = (aspectRatio: AspectRatio): string => {
  const held = ratioParts(aspectRatio);
  return `${held.width} / ${held.height}`;
};

export const slideUnits = (aspectRatio: AspectRatio, stage: StageSettings): Size => ({
  width: stage.unitsHigh * ratioOf(aspectRatio),
  height: stage.unitsHigh
});

export const clampZoom = (zoom: number, stage: StageSettings): number =>
  Math.min(Math.max(Math.round(zoom), stage.minimumZoom), stage.maximumZoom);

export const percent = (zoom: number | null): string => `${Math.round(zoom ?? 100)}%`;

export const fitted = (available: Size, aspectRatio: AspectRatio, gutter: number): Size => {
  const width = Math.max(0, available.width - gutter * 2);
  const height = Math.max(0, available.height - gutter * 2);
  const ratio = ratioOf(aspectRatio);
  if (width / ratio <= height) return { width, height: width / ratio };
  return { width: height * ratio, height };
};

export const drawn = (fit: Size, zoom: number | null): Size => {
  const at = (zoom ?? 100) / 100;
  return { width: fit.width * at, height: fit.height * at };
};

export const scaleOf = (drawnWidth: number, unitsWidth: number): number =>
  unitsWidth === 0 ? 1 : drawnWidth / unitsWidth;

export const toPixels = (frame: Frame, units: Size): Pixels => ({
  x: frame.x * units.width,
  y: frame.y * units.height,
  width: frame.width * units.width,
  height: frame.height * units.height
});

export const toFrame = (held: Pixels, units: Size): Frame => ({
  x: held.x / units.width,
  y: held.y / units.height,
  width: held.width / units.width,
  height: held.height / units.height
});

export const rounded = (frame: Frame, places = 4): Frame => {
  const factor = 10 ** places;
  const round = (value: number) => Math.round(value * factor) / factor;
  return { x: round(frame.x), y: round(frame.y), width: round(frame.width), height: round(frame.height) };
};

export const figures = (held: Size): string =>
  `${held.width.toFixed(2)} × ${held.height.toFixed(2)}`;

export const pixels = (held: Size): string =>
  `${Math.round(held.width)} × ${Math.round(held.height)}`;

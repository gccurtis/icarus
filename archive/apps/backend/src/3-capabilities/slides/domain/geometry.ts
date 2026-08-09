import type { ElementFrame, SlideCanvas } from "./model.js";

/**
 * Slide geometry is in points and is deliberately *not* integral: half-point
 * positions are ordinary in authored decks, so the only requirements are
 * finiteness and positive extent.
 */
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isPositiveLength = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0;

export const isCanvasValid = (canvas: SlideCanvas): boolean =>
  isPositiveLength(canvas.widthPt) && isPositiveLength(canvas.heightPt);

export const isFrameValid = (frame: ElementFrame): boolean =>
  isFiniteNumber(frame.xPt) &&
  isFiniteNumber(frame.yPt) &&
  isPositiveLength(frame.widthPt) &&
  isPositiveLength(frame.heightPt);

/**
 * Frames may extend past the canvas — bleed and deliberate overflow are normal
 * authoring, and clipping is a rendering decision. This predicate exists for
 * projections that want to report it, never for validation.
 */
export const isFrameWithinCanvas = (
  frame: ElementFrame,
  canvas: SlideCanvas
): boolean =>
  frame.xPt >= 0 &&
  frame.yPt >= 0 &&
  frame.xPt + frame.widthPt <= canvas.widthPt &&
  frame.yPt + frame.heightPt <= canvas.heightPt;

export const framesIntersect = (left: ElementFrame, right: ElementFrame): boolean =>
  left.xPt < right.xPt + right.widthPt &&
  right.xPt < left.xPt + left.widthPt &&
  left.yPt < right.yPt + right.heightPt &&
  right.yPt < left.yPt + left.heightPt;

/** Rotation is stored as authored; only finiteness is required. */
export const isRotationValid = (rotationDegrees: number | undefined): boolean =>
  rotationDegrees === undefined || isFiniteNumber(rotationDegrees);

export const translateFrame = (
  frame: ElementFrame,
  dxPt: number,
  dyPt: number
): ElementFrame => ({
  xPt: frame.xPt + dxPt,
  yPt: frame.yPt + dyPt,
  widthPt: frame.widthPt,
  heightPt: frame.heightPt
});

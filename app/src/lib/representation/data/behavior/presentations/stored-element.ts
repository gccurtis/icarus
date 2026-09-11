import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import {
  hasExactFields,
  isStoredChoice,
  isStoredFinite,
  isStoredIdentifier,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type {
  Frame,
  SlideBackground,
  SlideElement
} from "$representation/data/types/presentations/body";

export const isStoredFrame = (value: unknown): value is Frame => {
  const frame = storedFields(value);
  return frame !== undefined &&
    hasExactFields(frame, ["x", "y", "width", "height"]) &&
    isStoredFinite(frame.x) &&
    isStoredFinite(frame.y) &&
    isStoredFinite(frame.width) && frame.width > 0 &&
    isStoredFinite(frame.height) && frame.height > 0;
};

const isStoredPoint = (value: unknown): boolean => {
  const point = storedFields(value);
  return point !== undefined &&
    hasExactFields(point, ["x", "y"]) &&
    isStoredFinite(point.x) &&
    isStoredFinite(point.y);
};

export const isStoredSlideBackground = (value: unknown): value is SlideBackground => {
  const background = storedFields(value);
  if (background?.kind === "color") {
    return hasExactFields(background, ["kind", "color"]) &&
      isStoredText(background.color, 10_000);
  }
  return background?.kind === "image" &&
    hasExactFields(background, ["kind", "fileId", "fit"]) &&
    isStoredRowId(background.fileId, "externalFiles") &&
    (background.fit === "cover" || background.fit === "contain");
};

const isStoredPaint = (value: unknown): boolean => {
  const paint = storedFields(value);
  if (
    paint === undefined ||
    !hasExactFields(paint, [], ["fill", "stroke", "opacity", "cornerRadius", "shadow"])
  ) return false;
  const stroke = paint.stroke === undefined ? undefined : storedFields(paint.stroke);
  const shadow = paint.shadow === undefined ? undefined : storedFields(paint.shadow);
  return (paint.fill === undefined || isStoredText(paint.fill, 10_000)) &&
    (paint.stroke === undefined || (
      stroke !== undefined &&
      hasExactFields(stroke, ["color", "width"], ["dash"]) &&
      isStoredText(stroke.color, 10_000) &&
      isStoredFinite(stroke.width) && stroke.width >= 0 && stroke.width <= 1_000 &&
      (stroke.dash === undefined || stroke.dash === "solid" || stroke.dash === "dashed" || stroke.dash === "dotted")
    )) &&
    (paint.opacity === undefined || (
      isStoredFinite(paint.opacity) && paint.opacity >= 0 && paint.opacity <= 1
    )) &&
    (paint.cornerRadius === undefined || (
      isStoredFinite(paint.cornerRadius) && paint.cornerRadius >= 0 && paint.cornerRadius <= 10_000
    )) &&
    (paint.shadow === undefined || (
      shadow !== undefined &&
      hasExactFields(shadow, ["color", "x", "y", "blur"]) &&
      isStoredText(shadow.color, 10_000) &&
      isStoredFinite(shadow.x) && Math.abs(shadow.x) <= 10_000 &&
      isStoredFinite(shadow.y) && Math.abs(shadow.y) <= 10_000 &&
      isStoredFinite(shadow.blur) && shadow.blur >= 0 && shadow.blur <= 10_000
    ));
};

const blockOfType = (value: unknown, type: string): boolean => {
  const admitted = admitContentBlocks([value]);
  return admitted !== undefined && admitted[0]?.type === type;
};

const isStoredLineEnds = (value: unknown): boolean => {
  const ends = storedFields(value);
  const valid = (end: unknown) => end === "none" || end === "arrow" || end === "dot";
  return ends !== undefined &&
    hasExactFields(ends, [], ["start", "end"]) &&
    (ends.start === undefined || valid(ends.start)) &&
    (ends.end === undefined || valid(ends.end));
};

const isStoredElementContent = (value: unknown, depth: number): boolean => {
  const content = storedFields(value);
  if (content === undefined || depth > 12) return false;
  if (
    content.type === "text" || content.type === "formula" ||
    content.type === "prompt" || content.type === "image"
  ) {
    return hasExactFields(content, ["type", "block"]) &&
      blockOfType(content.block, content.type);
  }
  if (content.type === "table") {
    const block = storedFields(content.block);
    return hasExactFields(content, ["type", "block"], ["rowHeights"]) &&
      blockOfType(content.block, "table") &&
      (content.rowHeights === undefined || (
        Array.isArray(content.rowHeights) &&
        content.rowHeights.length <= 1_000 &&
        Array.isArray(block?.rows) &&
        content.rowHeights.length === block.rows.length &&
        content.rowHeights.every(
          (height) => isStoredFinite(height) && height > 0 && height <= 10_000
        )
      ));
  }
  if (content.type === "shape") {
    return hasExactFields(content, ["type", "shape"], ["block"]) &&
      isStoredChoice(content.shape, ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"]) &&
      (content.block === undefined || blockOfType(content.block, "text"));
  }
  if (content.type === "line") {
    return hasExactFields(content, ["type", "from", "to"], ["ends"]) &&
      isStoredPoint(content.from) &&
      isStoredPoint(content.to) &&
      (content.ends === undefined || isStoredLineEnds(content.ends));
  }
  if (content.type === "chart") {
    return hasExactFields(content, ["type", "spec"]) && storedFields(content.spec) !== undefined;
  }
  return content.type === "group" &&
    hasExactFields(content, ["type", "children"]) &&
    Array.isArray(content.children) &&
    content.children.length <= 2_000 &&
    content.children.every((child) => isStoredSlideElementAt(child, depth + 1));
};

const isStoredSlideElementAt = (value: unknown, depth: number): value is SlideElement => {
  const element = storedFields(value);
  return element !== undefined &&
    hasExactFields(
      element,
      ["id", "frame", "content"],
      ["rotation", "overflow", "paint", "locked", "fromPlaceholder"]
    ) &&
    isStoredIdentifier(element.id) &&
    isStoredFrame(element.frame) &&
    (element.rotation === undefined || (
      isStoredFinite(element.rotation) && element.rotation >= -36_000 && element.rotation <= 36_000
    )) &&
    (element.overflow === undefined || isStoredChoice(element.overflow, ["clip", "shrink", "grow"])) &&
    (element.paint === undefined || isStoredPaint(element.paint)) &&
    (element.locked === undefined || typeof element.locked === "boolean") &&
    (element.fromPlaceholder === undefined || isStoredIdentifier(element.fromPlaceholder)) &&
    isStoredElementContent(element.content, depth);
};

export const isStoredSlideElement = (value: unknown): value is SlideElement =>
  isStoredSlideElementAt(value, 0);

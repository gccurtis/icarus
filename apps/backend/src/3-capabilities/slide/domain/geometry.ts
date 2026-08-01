import { SlideOperationError } from "./errors.js";
import type {
  ShapeFrame,
  Slide,
  SlideElement,
  SlideOperation,
  SlideShape
} from "./model.js";

export interface ShapeBounds extends ShapeFrame {}

export interface GroupTransformDelta {
  translateXPt?: number;
  translateYPt?: number;
  scaleX?: number;
  scaleY?: number;
  rotationDegrees?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

const rotatedShapeBounds = (shape: SlideShape): ShapeBounds => {
  const { xPt, yPt, widthPt, heightPt } = shape.frame;
  const radians = shape.transform.rotationDegrees * Math.PI / 180;
  if (radians === 0) return { xPt, yPt, widthPt, heightPt };

  const centerX = xPt + widthPt / 2;
  const centerY = yPt + heightPt / 2;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const corners = [
    [xPt, yPt],
    [xPt + widthPt, yPt],
    [xPt + widthPt, yPt + heightPt],
    [xPt, yPt + heightPt]
  ].map(([x, y]) => ({
    x: centerX + (x - centerX) * cosine - (y - centerY) * sine,
    y: centerY + (x - centerX) * sine + (y - centerY) * cosine
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { xPt: minX, yPt: minY, widthPt: maxX - minX, heightPt: maxY - minY };
};

export const unionBounds = (
  values: ShapeBounds[]
): ShapeBounds | undefined => {
  if (values.length === 0) return undefined;
  const minX = Math.min(...values.map((value) => value.xPt));
  const minY = Math.min(...values.map((value) => value.yPt));
  const maxX = Math.max(...values.map((value) => value.xPt + value.widthPt));
  const maxY = Math.max(...values.map((value) => value.yPt + value.heightPt));
  return { xPt: minX, yPt: minY, widthPt: maxX - minX, heightPt: maxY - minY };
};

export const computeShapeBounds = (shape: SlideShape): ShapeBounds =>
  rotatedShapeBounds(shape);

const computeElementBoundsInner = (
  slide: Slide,
  element: SlideElement,
  ancestors: Set<string>
): ShapeBounds | undefined => {
  if (element.elementKind === "shape") return computeShapeBounds(element);
  if (ancestors.has(element.id)) {
    throw new SlideOperationError(`Group cycle while computing bounds: ${element.id}`);
  }
  const nextAncestors = new Set(ancestors).add(element.id);
  return unionBounds(element.childElementIds.map((id) => {
    const child = Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined;
    if (!child) throw new SlideOperationError(`Group ${element.id} references missing element ${id}`);
    return computeElementBoundsInner(slide, child, nextAncestors);
  }).filter((bounds): bounds is ShapeBounds => bounds !== undefined));
};

/** Includes hidden descendants; visibility never changes structural bounds. */
export const computeElementBounds = (
  slide: Slide,
  elementId: string
): ShapeBounds | undefined => {
  const element = Object.hasOwn(slide.elements, elementId) ? slide.elements[elementId] : undefined;
  if (!element) throw new SlideOperationError(`Element not found: ${elementId}`);
  return computeElementBoundsInner(slide, element, new Set());
};

export const computeGroupBounds = (
  slide: Slide,
  groupId: string
): ShapeBounds | undefined => {
  const element = Object.hasOwn(slide.elements, groupId) ? slide.elements[groupId] : undefined;
  if (!element || element.elementKind !== "group") {
    throw new SlideOperationError(`Group not found: ${groupId}`);
  }
  return computeElementBoundsInner(slide, element, new Set());
};

const normalizedRotation = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

/**
 * Expand a UI group gesture into canonical descendant Shape operations.
 * Groups remain structural and never persist this delta.
 */
export const expandGroupTransform = (
  snapshot: { slides: Record<string, Slide> },
  slideId: string,
  groupId: string,
  delta: GroupTransformDelta
): SlideOperation[] => {
  const slide = Object.hasOwn(snapshot.slides, slideId) ? snapshot.slides[slideId] : undefined;
  if (!slide) throw new SlideOperationError(`Slide not found: ${slideId}`);
  const group = Object.hasOwn(slide.elements, groupId) ? slide.elements[groupId] : undefined;
  if (!group || group.elementKind !== "group") {
    throw new SlideOperationError(`Group not found: ${groupId}`);
  }
  const bounds = computeGroupBounds(slide, groupId);
  if (!bounds) throw new SlideOperationError(`Group has no Shape descendants: ${groupId}`);

  const translateXPt = delta.translateXPt ?? 0;
  const translateYPt = delta.translateYPt ?? 0;
  const scaleX = delta.scaleX ?? 1;
  const scaleY = delta.scaleY ?? 1;
  const rotationDegrees = delta.rotationDegrees ?? 0;
  for (const value of [translateXPt, translateYPt, scaleX, scaleY, rotationDegrees]) {
    if (!Number.isFinite(value)) throw new SlideOperationError("Group transform values must be finite");
  }
  if (scaleX === 0 || scaleY === 0) {
    throw new SlideOperationError("Group transform scale must be non-zero");
  }

  const centerX = bounds.xPt + bounds.widthPt / 2;
  const centerY = bounds.yPt + bounds.heightPt / 2;
  const radians = rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const shapes: SlideShape[] = [];
  const seen = new Set<string>();
  const collect = (ids: string[]): void => {
    for (const id of ids) {
      if (seen.has(id)) throw new SlideOperationError(`Group cycle while expanding transform: ${id}`);
      seen.add(id);
      const element = Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined;
      if (!element) throw new SlideOperationError(`Group references missing element: ${id}`);
      if (element.elementKind === "shape") shapes.push(element);
      else collect(element.childElementIds);
    }
  };
  collect(group.childElementIds);

  return shapes.flatMap((shape): SlideOperation[] => {
    const shapeCenterX = shape.frame.xPt + shape.frame.widthPt / 2;
    const shapeCenterY = shape.frame.yPt + shape.frame.heightPt / 2;
    const scaledX = (shapeCenterX - centerX) * scaleX;
    const scaledY = (shapeCenterY - centerY) * scaleY;
    const transformedCenterX = centerX + scaledX * cosine - scaledY * sine + translateXPt;
    const transformedCenterY = centerY + scaledX * sine + scaledY * cosine + translateYPt;
    const widthPt = shape.frame.widthPt * Math.abs(scaleX);
    const heightPt = shape.frame.heightPt * Math.abs(scaleY);
    return [
      {
        type: "shape.set-frame",
        slideId,
        shapeId: shape.id,
        frame: {
          xPt: transformedCenterX - widthPt / 2,
          yPt: transformedCenterY - heightPt / 2,
          widthPt,
          heightPt
        }
      },
      {
        type: "shape.set-transform",
        slideId,
        shapeId: shape.id,
        transform: {
          rotationDegrees: normalizedRotation(shape.transform.rotationDegrees + rotationDegrees),
          flipHorizontal: shape.transform.flipHorizontal !== (
            Boolean(delta.flipHorizontal) !== (scaleX < 0)
          ),
          flipVertical: shape.transform.flipVertical !== (
            Boolean(delta.flipVertical) !== (scaleY < 0)
          )
        }
      }
    ];
  });
};

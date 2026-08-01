import type { SlideElement, SlideOperation } from "../domain/model.js";
import {
  SLIDE_SHAPE_KINDS,
  SLIDE_WIRE_LIMITS,
  SlideWireError,
  assertSlideWireInput,
  decodeChartShapeData,
  decodeGeometryDefinition,
  decodeImageShapeData,
  decodeLineDefinition,
  decodeOutputRef,
  decodePlacement,
  decodePresentation,
  decodeRichTextOperations,
  decodeShapeFrame,
  decodeShapeTransform,
  decodeSlide,
  decodeSlideBackground,
  decodeSlideGroup,
  decodeSlideShape,
  decodeSlideStyle,
  decodeSlideCanvas,
  decodeTableShapeData,
  decodeTextBox,
  exactKeys,
  requireArray,
  requireBoolean,
  requireEnum,
  requireIdentifier,
  requireRecord,
  requireString,
  requireText
} from "./valueSchemas.js";

export {
  SLIDE_WIRE_LIMITS,
  SlideWireError,
  assertSlideWireInput,
  exactKeys,
  requireRecord,
  requireString,
  requireText,
  requireNonNegativeInteger
} from "./valueSchemas.js";

const OPERATION_KEYS: Record<SlideOperation["type"], readonly string[]> = {
  "deck.rename": ["type", "title"],
  "deck.set-lifecycle": ["type", "lifecycle"],
  "deck.set-canvas": ["type", "canvas"],
  "style.create": ["type", "style"],
  "style.update": ["type", "styleId", "style"],
  "style.delete": ["type", "styleId", "replacementStyleId"],
  "style.set-default": ["type", "shapeKind", "styleId"],
  "slide.insert": ["type", "slide", "afterSlideId"],
  "slide.move": ["type", "slideId", "afterSlideId"],
  "slide.delete": ["type", "slideId"],
  "slide.set-title": ["type", "slideId", "title"],
  "slide.set-background": ["type", "slideId", "background"],
  "notes.apply": ["type", "slideId", "operations"],
  "group.create": ["type", "slideId", "group"],
  "group.ungroup": ["type", "slideId", "groupId"],
  "shape.insert": ["type", "slideId", "shape", "placement"],
  "element.restore-subtree": [
    "type", "slideId", "rootElementId", "elements", "placement",
    "adoptedElementId"
  ],
  "element.move": ["type", "slideId", "elementId", "placement"],
  "element.delete": ["type", "slideId", "elementId"],
  "element.set-locked": ["type", "slideId", "elementId", "locked"],
  "element.set-hidden": ["type", "slideId", "elementId", "hidden"],
  "shape.set-frame": ["type", "slideId", "shapeId", "frame"],
  "shape.set-transform": ["type", "slideId", "shapeId", "transform"],
  "shape.set-style": ["type", "slideId", "shapeId", "styleId"],
  "shape.set-presentation": ["type", "slideId", "shapeId", "presentation"],
  "text-box.set-presentation": ["type", "slideId", "shapeId", "textBox"],
  "text.apply": ["type", "slideId", "shapeId", "operations"],
  "prompt-content.apply-derived-output": ["type", "slideId", "shapeId", "output"],
  "geometry.set": ["type", "slideId", "shapeId", "geometry"],
  "line.set": ["type", "slideId", "shapeId", "line"],
  "image.set": ["type", "slideId", "shapeId", "image"],
  "table.set": ["type", "slideId", "shapeId", "table"],
  "chart.set": ["type", "slideId", "shapeId", "chart"]
};

const optionalIdentifier = (value: unknown, label: string): void => {
  if (value !== undefined) requireIdentifier(value, label);
};

const decodeSlideElement = (value: unknown, label: string): SlideElement => {
  const raw = requireRecord(value, label);
  if (raw.elementKind === "group") return decodeSlideGroup(raw, label);
  if (raw.elementKind === "shape") return decodeSlideShape(raw, label);
  throw new SlideWireError(`${label}.elementKind must be group or shape`);
};

export const decodeSlideOperation = (value: unknown): SlideOperation => {
  assertSlideWireInput(value, "operation");
  const operation = requireRecord(value, "operation");
  const type = requireString(operation.type, "operation.type") as SlideOperation["type"];
  const keys = OPERATION_KEYS[type];
  if (!keys) throw new SlideWireError(`Unknown Slide operation: ${type}`);
  exactKeys(operation, keys, type);

  switch (type) {
    case "deck.rename":
      requireString(operation.title, `${type}.title`);
      break;
    case "deck.set-lifecycle":
      requireEnum(operation.lifecycle, ["active", "archived", "trashed"], `${type}.lifecycle`);
      break;
    case "deck.set-canvas":
      decodeSlideCanvas(operation.canvas, `${type}.canvas`);
      break;
    case "style.create":
      decodeSlideStyle(operation.style, `${type}.style`);
      break;
    case "style.update":
      requireIdentifier(operation.styleId, `${type}.styleId`);
      decodeSlideStyle(operation.style, `${type}.style`);
      break;
    case "style.delete":
      requireIdentifier(operation.styleId, `${type}.styleId`);
      requireIdentifier(operation.replacementStyleId, `${type}.replacementStyleId`);
      break;
    case "style.set-default":
      requireEnum(operation.shapeKind, SLIDE_SHAPE_KINDS, `${type}.shapeKind`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "slide.insert":
      decodeSlide(operation.slide, `${type}.slide`);
      optionalIdentifier(operation.afterSlideId, `${type}.afterSlideId`);
      break;
    case "slide.move":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      optionalIdentifier(operation.afterSlideId, `${type}.afterSlideId`);
      break;
    case "slide.delete":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      break;
    case "slide.set-title":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      if (operation.title !== undefined) requireText(operation.title, `${type}.title`);
      break;
    case "slide.set-background":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      decodeSlideBackground(operation.background, `${type}.background`);
      break;
    case "notes.apply":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      decodeRichTextOperations(operation.operations, `${type}.operations`);
      break;
    case "group.create":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      decodeSlideGroup(operation.group, `${type}.group`);
      break;
    case "group.ungroup":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.groupId, `${type}.groupId`);
      break;
    case "shape.insert":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      decodeSlideShape(operation.shape, `${type}.shape`);
      decodePlacement(operation.placement, `${type}.placement`);
      break;
    case "element.restore-subtree":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.rootElementId, `${type}.rootElementId`);
      requireArray(operation.elements, `${type}.elements`).forEach((element, index) =>
        decodeSlideElement(element, `${type}.elements[${index}]`));
      decodePlacement(operation.placement, `${type}.placement`);
      optionalIdentifier(operation.adoptedElementId, `${type}.adoptedElementId`);
      break;
    case "element.move":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.elementId, `${type}.elementId`);
      decodePlacement(operation.placement, `${type}.placement`);
      break;
    case "element.delete":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.elementId, `${type}.elementId`);
      break;
    case "element.set-locked":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.elementId, `${type}.elementId`);
      requireBoolean(operation.locked, `${type}.locked`);
      break;
    case "element.set-hidden":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.elementId, `${type}.elementId`);
      requireBoolean(operation.hidden, `${type}.hidden`);
      break;
    case "shape.set-frame":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeShapeFrame(operation.frame, `${type}.frame`);
      break;
    case "shape.set-transform":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeShapeTransform(operation.transform, `${type}.transform`);
      break;
    case "shape.set-style":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "shape.set-presentation":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      if (operation.presentation !== undefined) {
        decodePresentation(operation.presentation, `${type}.presentation`);
      }
      break;
    case "text-box.set-presentation":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeTextBox(operation.textBox, `${type}.textBox`);
      break;
    case "text.apply":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeRichTextOperations(operation.operations, `${type}.operations`);
      break;
    case "prompt-content.apply-derived-output":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeOutputRef(operation.output, `${type}.output`);
      break;
    case "geometry.set":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeGeometryDefinition(operation.geometry, `${type}.geometry`);
      break;
    case "line.set":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeLineDefinition(operation.line, `${type}.line`);
      break;
    case "image.set":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeImageShapeData(operation.image, `${type}.image`);
      break;
    case "table.set":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeTableShapeData(operation.table, `${type}.table`);
      break;
    case "chart.set":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.shapeId, `${type}.shapeId`);
      decodeChartShapeData(operation.chart, `${type}.chart`);
      break;
  }

  return structuredClone(operation) as unknown as SlideOperation;
};

export const decodeSlideOperations = (value: unknown): SlideOperation[] => {
  const operations = requireArray(value, "operations", SLIDE_WIRE_LIMITS.maxOperations);
  if (operations.length === 0) throw new SlideWireError("operations must not be empty");
  return operations.map(decodeSlideOperation);
};

import type { SlideOperation } from "../domain/model.js";
import {
  SLIDE_ELEMENT_KINDS,
  SLIDE_WIRE_LIMITS,
  SlideWireError,
  assertSlideWireInput,
  decodeBackground,
  decodeCanvas,
  decodeContainerRef,
  decodeDerivedOutputRef,
  decodeDesignToken,
  decodeElement,
  decodeLayout,
  decodeLayoutSlot,
  decodeMaster,
  decodeMediaSnapshotRef,
  decodePalette,
  decodePlacement,
  decodePromptSite,
  decodeRichContentTarget,
  decodeRichTextOperations,
  decodeSlide,
  decodeSlideStyle,
  decodeTableColumn,
  decodeTableMerge,
  decodeTableRow,
  decodeTableCell,
  decodeTextSource,
  decodeTypography,
  exactKeys,
  requireArray,
  requireBoolean,
  requireEnum,
  requireFiniteNumber,
  requireIdentifier,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  requireText
} from "./valueSchemas.js";

/**
 * The single table that keeps the decoder and the operation union from
 * drifting. It is typed `Record<SlideOperation["type"], …>`, so adding a member
 * to the union without adding a row here is a compile error, and the switch
 * below is exhaustive for the same reason.
 */
const OPERATION_KEYS: Record<SlideOperation["type"], readonly string[]> = {
  "deck.rename": ["type", "title"],
  "deck.set-lifecycle": ["type", "lifecycle"],
  "canvas.set": ["type", "canvas"],
  "theme.rename": ["type", "name"],
  "theme.set-palette": ["type", "palette"],
  "theme.set-typography": ["type", "typography"],
  "token.create": ["type", "token"],
  "token.update": ["type", "tokenId", "token"],
  "token.delete": ["type", "tokenId", "replacementTokenId"],
  "style.create": ["type", "style"],
  "style.update": ["type", "styleId", "style"],
  "style.delete": ["type", "styleId", "replacementStyleId"],
  "style.set-default": ["type", "elementKind", "styleId"],
  "master.insert": ["type", "master"],
  "master.rename": ["type", "masterId", "name"],
  "master.set-background": ["type", "masterId", "background"],
  "master.delete": ["type", "masterId", "replacementMasterId"],
  "layout.insert": ["type", "layout"],
  "layout.rename": ["type", "layoutId", "name"],
  "layout.set-master": ["type", "layoutId", "masterId"],
  "layout.set-background": ["type", "layoutId", "background"],
  "layout.delete": ["type", "layoutId", "replacementLayoutId"],
  "slot.insert": ["type", "layoutId", "slot"],
  "slot.update": ["type", "layoutId", "slot"],
  "slot.delete": ["type", "layoutId", "slotId"],
  "slide.insert": ["type", "slide", "afterSlideId"],
  "slide.move": ["type", "slideId", "afterSlideId"],
  "slide.delete": ["type", "slideId"],
  "slide.set-layout": ["type", "slideId", "layoutId"],
  "slide.set-title": ["type", "slideId", "title"],
  "slide.set-background": ["type", "slideId", "background"],
  "element.insert": ["type", "container", "element"],
  "element.replace": ["type", "container", "element"],
  "element.reorder": ["type", "container", "elementId", "parentGroupId", "zIndex"],
  "element.delete": ["type", "container", "elementId"],
  "element.set-placement": ["type", "container", "elementId", "placement"],
  "element.set-style": ["type", "container", "elementId", "styleId"],
  "element.set-rotation": ["type", "container", "elementId", "rotationDegrees"],
  "element.set-flags": ["type", "container", "elementId", "locked", "hidden"],
  "element.group": ["type", "container", "group", "memberIds"],
  "element.ungroup": ["type", "container", "groupId"],
  "text-source.set": ["type", "target", "source"],
  "rich-text.apply": ["type", "target", "operations"],
  "prompt.apply-derived-output": ["type", "site", "output"],
  "table.insert-row": ["type", "container", "elementId", "row", "cells", "afterRowId"],
  "table.move-row": ["type", "container", "elementId", "rowId", "afterRowId"],
  "table.delete-row": ["type", "container", "elementId", "rowId"],
  "table.insert-column": [
    "type", "container", "elementId", "column", "cells", "afterColumnId"
  ],
  "table.move-column": ["type", "container", "elementId", "columnId", "afterColumnId"],
  "table.delete-column": ["type", "container", "elementId", "columnId"],
  "table.merge": ["type", "container", "elementId", "merge"],
  "table.unmerge": ["type", "container", "elementId", "mergeId"],
  "image.set-source": ["type", "container", "elementId", "source"],
  "image.set-accessibility": ["type", "container", "elementId", "alt", "decorative"]
};

/** Every operation type the decoder accepts. Exported so a test can assert parity. */
export const SLIDE_OPERATION_TYPES = Object.keys(OPERATION_KEYS) as SlideOperation["type"][];

const optionalIdentifier = (value: unknown, label: string): void => {
  if (value !== undefined) requireIdentifier(value, label);
};

const requireCells = (value: unknown, label: string): void => {
  requireArray(value, label).forEach((cell, index) =>
    decodeTableCell(cell, `${label}[${index}]`));
};

const requireContainerAndElement = (
  operation: Record<string, unknown>,
  type: string
): void => {
  decodeContainerRef(operation.container, `${type}.container`);
  requireIdentifier(operation.elementId, `${type}.elementId`);
};

export const decodeSlideOperation = (value: unknown): SlideOperation => {
  assertSlideWireInput(value, "operation");
  const operation = requireRecord(value, "operation");
  const type = requireString(operation.type, "operation.type") as SlideOperation["type"];
  const keys = OPERATION_KEYS[type];
  if (!keys) throw new SlideWireError(`Unknown Slides operation: ${type}`);
  exactKeys(operation, keys, type);

  switch (type) {
    case "deck.rename":
      requireString(operation.title, `${type}.title`);
      break;
    case "deck.set-lifecycle":
      requireEnum(operation.lifecycle, ["active", "archived", "trashed"] as const, `${type}.lifecycle`);
      break;
    case "canvas.set":
      decodeCanvas(operation.canvas, `${type}.canvas`);
      break;
    case "theme.rename":
      requireString(operation.name, `${type}.name`);
      break;
    case "theme.set-palette":
      decodePalette(operation.palette, `${type}.palette`);
      break;
    case "theme.set-typography":
      decodeTypography(operation.typography, `${type}.typography`);
      break;
    case "token.create":
      decodeDesignToken(operation.token, `${type}.token`);
      break;
    case "token.update":
      requireIdentifier(operation.tokenId, `${type}.tokenId`);
      decodeDesignToken(operation.token, `${type}.token`);
      break;
    case "token.delete":
      requireIdentifier(operation.tokenId, `${type}.tokenId`);
      requireIdentifier(operation.replacementTokenId, `${type}.replacementTokenId`);
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
      requireEnum(operation.elementKind, SLIDE_ELEMENT_KINDS, `${type}.elementKind`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "master.insert":
      decodeMaster(operation.master, `${type}.master`);
      break;
    case "master.rename":
      requireIdentifier(operation.masterId, `${type}.masterId`);
      requireString(operation.name, `${type}.name`);
      break;
    case "master.set-background":
      requireIdentifier(operation.masterId, `${type}.masterId`);
      decodeBackground(operation.background, `${type}.background`);
      break;
    case "master.delete":
      requireIdentifier(operation.masterId, `${type}.masterId`);
      requireIdentifier(operation.replacementMasterId, `${type}.replacementMasterId`);
      break;
    case "layout.insert":
      decodeLayout(operation.layout, `${type}.layout`);
      break;
    case "layout.rename":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      requireString(operation.name, `${type}.name`);
      break;
    case "layout.set-master":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      requireIdentifier(operation.masterId, `${type}.masterId`);
      break;
    case "layout.set-background":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      // Absent clears the override, which is a different thing from `inherit`.
      if (operation.background !== undefined) {
        decodeBackground(operation.background, `${type}.background`);
      }
      break;
    case "layout.delete":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      requireIdentifier(operation.replacementLayoutId, `${type}.replacementLayoutId`);
      break;
    case "slot.insert":
    case "slot.update":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      decodeLayoutSlot(operation.slot, `${type}.slot`);
      break;
    case "slot.delete":
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      requireIdentifier(operation.slotId, `${type}.slotId`);
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
    case "slide.set-layout":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      requireIdentifier(operation.layoutId, `${type}.layoutId`);
      break;
    case "slide.set-title":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      if (operation.title !== undefined) requireText(operation.title, `${type}.title`);
      break;
    case "slide.set-background":
      requireIdentifier(operation.slideId, `${type}.slideId`);
      if (operation.background !== undefined) {
        decodeBackground(operation.background, `${type}.background`);
      }
      break;
    case "element.insert":
    case "element.replace":
      decodeContainerRef(operation.container, `${type}.container`);
      decodeElement(operation.element, `${type}.element`);
      break;
    case "element.reorder":
      requireContainerAndElement(operation, type);
      optionalIdentifier(operation.parentGroupId, `${type}.parentGroupId`);
      requireNonNegativeInteger(operation.zIndex, `${type}.zIndex`);
      break;
    case "element.delete":
      requireContainerAndElement(operation, type);
      break;
    case "element.set-placement":
      requireContainerAndElement(operation, type);
      decodePlacement(operation.placement, `${type}.placement`);
      break;
    case "element.set-style":
      requireContainerAndElement(operation, type);
      optionalIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "element.set-rotation":
      requireContainerAndElement(operation, type);
      if (operation.rotationDegrees !== undefined) {
        requireFiniteNumber(operation.rotationDegrees, `${type}.rotationDegrees`);
      }
      break;
    case "element.set-flags":
      requireContainerAndElement(operation, type);
      requireBoolean(operation.locked, `${type}.locked`);
      requireBoolean(operation.hidden, `${type}.hidden`);
      break;
    case "element.group": {
      decodeContainerRef(operation.container, `${type}.container`);
      decodeElement(operation.group, `${type}.group`);
      const members = requireArray(operation.memberIds, `${type}.memberIds`);
      if (members.length === 0) {
        throw new SlideWireError(`${type}.memberIds must not be empty`);
      }
      members.forEach((id, index) =>
        requireIdentifier(id, `${type}.memberIds[${index}]`));
      break;
    }
    case "element.ungroup":
      decodeContainerRef(operation.container, `${type}.container`);
      requireIdentifier(operation.groupId, `${type}.groupId`);
      break;
    case "text-source.set":
      decodePromptSite(operation.target, `${type}.target`);
      decodeTextSource(operation.source, `${type}.source`);
      break;
    case "rich-text.apply":
      decodeRichContentTarget(operation.target, `${type}.target`);
      decodeRichTextOperations(operation.operations, `${type}.operations`);
      break;
    case "prompt.apply-derived-output":
      decodePromptSite(operation.site, `${type}.site`);
      decodeDerivedOutputRef(operation.output, `${type}.output`);
      break;
    case "table.insert-row":
      requireContainerAndElement(operation, type);
      decodeTableRow(operation.row, `${type}.row`);
      requireCells(operation.cells, `${type}.cells`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "table.move-row":
      requireContainerAndElement(operation, type);
      requireIdentifier(operation.rowId, `${type}.rowId`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "table.delete-row":
      requireContainerAndElement(operation, type);
      requireIdentifier(operation.rowId, `${type}.rowId`);
      break;
    case "table.insert-column":
      requireContainerAndElement(operation, type);
      decodeTableColumn(operation.column, `${type}.column`);
      requireCells(operation.cells, `${type}.cells`);
      optionalIdentifier(operation.afterColumnId, `${type}.afterColumnId`);
      break;
    case "table.move-column":
      requireContainerAndElement(operation, type);
      requireIdentifier(operation.columnId, `${type}.columnId`);
      optionalIdentifier(operation.afterColumnId, `${type}.afterColumnId`);
      break;
    case "table.delete-column":
      requireContainerAndElement(operation, type);
      requireIdentifier(operation.columnId, `${type}.columnId`);
      break;
    case "table.merge":
      requireContainerAndElement(operation, type);
      decodeTableMerge(operation.merge, `${type}.merge`);
      break;
    case "table.unmerge":
      requireContainerAndElement(operation, type);
      requireIdentifier(operation.mergeId, `${type}.mergeId`);
      break;
    case "image.set-source":
      requireContainerAndElement(operation, type);
      decodeMediaSnapshotRef(operation.source, `${type}.source`);
      break;
    case "image.set-accessibility":
      requireContainerAndElement(operation, type);
      requireText(operation.alt, `${type}.alt`);
      requireBoolean(operation.decorative, `${type}.decorative`);
      break;
  }

  return structuredClone(operation) as unknown as SlideOperation;
};

export const decodeSlideOperations = (value: unknown): SlideOperation[] => {
  if (!Array.isArray(value)) throw new SlideWireError("operations must be an array");
  if (value.length === 0) throw new SlideWireError("operations must not be empty");
  if (value.length > SLIDE_WIRE_LIMITS.maxOperations) {
    throw new SlideWireError("operations exceeds the operation limit");
  }
  return value.map(decodeSlideOperation);
};

export {
  SLIDE_WIRE_LIMITS,
  SlideWireError,
  assertSlideWireInput,
  exactKeys,
  requireRecord,
  requireString
} from "./valueSchemas.js";

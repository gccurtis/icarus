import type { DocumentOperation } from "../domain/model.js";
import {
  DOCUMENT_WIRE_LIMITS,
  DocumentWireError,
  assertDocumentWireInput,
  decodeDimensions,
  decodeDocumentBlock,
  decodeDocumentRow,
  decodeDocumentStyle,
  decodeListItem,
  decodeMediaSnapshotRef,
  decodePageLayout,
  decodePlacement,
  decodePresentation,
  decodeRichTextOperations,
  decodeRowLayout,
  decodeTableCell,
  decodeTableColumn,
  decodeTableMerge,
  decodeTableRow,
  decodeTextRange,
  decodeTextStyleProperties,
  exactKeys,
  requireBoolean,
  requireEnum,
  requireIdentifier,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  requireText,
} from "./valueSchemas.js";

export {
  DOCUMENT_WIRE_LIMITS,
  DocumentWireError,
  assertDocumentWireInput,
  exactKeys,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  requireText,
} from "./valueSchemas.js";

const BLOCK_KINDS = [
  "text", "code", "quote", "prompt", "divider", "callout", "list", "table", "image", "chart",
] as const;

const OPERATION_KEYS: Record<DocumentOperation["type"], readonly string[]> = {
  "document.rename": ["type", "title"],
  "document.set-lifecycle": ["type", "lifecycle"],
  "layout.set-page": ["type", "layout"],
  "style.create": ["type", "style"],
  "style.update": ["type", "styleId", "style"],
  "style.delete": ["type", "styleId", "replacementStyleId"],
  "style.set-default": ["type", "blockKind", "styleId"],
  "style.apply-inline": ["type", "blockId", "styleId", "markId", "range", "resolvedProperties"],
  "row.insert": ["type", "row", "afterRowId"],
  "row.move": ["type", "rowId", "afterRowId"],
  "row.delete": ["type", "rowId"],
  "row.set-layout": ["type", "rowId", "layout"],
  "block.insert": ["type", "block", "placement"],
  "block.move": ["type", "blockId", "placement"],
  "block.replace": ["type", "blockId", "block"],
  "block.delete": ["type", "blockId"],
  "block.set-style": ["type", "blockId", "styleId"],
  "block.set-presentation": ["type", "blockId", "presentation"],
  "rich-text.apply": ["type", "blockId", "operations"],
  "prompt.apply-derived-output": ["type", "blockId", "output"],
  "list.insert-item": ["type", "listId", "parentItemId", "item", "afterItemId"],
  "list.move-item": ["type", "listId", "itemId", "parentItemId", "afterItemId"],
  "list.delete-item": ["type", "listId", "itemId"],
  "list.set-checked": ["type", "listId", "itemId", "checked"],
  "table.insert-row": ["type", "tableId", "row", "cells", "afterRowId"],
  "table.move-row": ["type", "tableId", "rowId", "afterRowId"],
  "table.delete-row": ["type", "tableId", "rowId"],
  "table.insert-column": ["type", "tableId", "column", "cells", "afterColumnId"],
  "table.move-column": ["type", "tableId", "columnId", "afterColumnId"],
  "table.delete-column": ["type", "tableId", "columnId"],
  "table.merge": ["type", "tableId", "merge"],
  "table.unmerge": ["type", "tableId", "mergeId"],
  "image.set-source": ["type", "blockId", "source"],
  "image.set-accessibility": ["type", "blockId", "alt", "decorative"],
  "visual.set-dimensions": ["type", "blockId", "dimensions"],
};

const optionalIdentifier = (value: unknown, label: string): void => {
  if (value !== undefined) requireIdentifier(value, label);
};

const requireCells = (value: unknown, label: string): void => {
  if (!Array.isArray(value)) throw new DocumentWireError(`${label} must be an array`);
  if (value.length > DOCUMENT_WIRE_LIMITS.maxCollectionItems) {
    throw new DocumentWireError(`${label} exceeds the collection limit`);
  }
  value.forEach((cell, index) => decodeTableCell(cell, `${label}[${index}]`));
};

export const decodeDocumentOperation = (value: unknown): DocumentOperation => {
  assertDocumentWireInput(value, "operation");
  const operation = requireRecord(value, "operation");
  const type = requireString(operation.type, "operation.type") as DocumentOperation["type"];
  const keys = OPERATION_KEYS[type];
  if (!keys) throw new DocumentWireError(`Unknown Document operation: ${type}`);
  exactKeys(operation, keys, type);

  switch (type) {
    case "document.rename":
      requireString(operation.title, `${type}.title`);
      break;
    case "document.set-lifecycle":
      requireEnum(operation.lifecycle, ["active", "archived"], `${type}.lifecycle`);
      break;
    case "layout.set-page":
      decodePageLayout(operation.layout, `${type}.layout`);
      break;
    case "style.create":
      decodeDocumentStyle(operation.style, `${type}.style`);
      break;
    case "style.update":
      requireIdentifier(operation.styleId, `${type}.styleId`);
      decodeDocumentStyle(operation.style, `${type}.style`);
      break;
    case "style.delete":
      requireIdentifier(operation.styleId, `${type}.styleId`);
      requireIdentifier(operation.replacementStyleId, `${type}.replacementStyleId`);
      break;
    case "style.set-default":
      requireEnum(operation.blockKind, BLOCK_KINDS, `${type}.blockKind`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "style.apply-inline":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      requireIdentifier(operation.markId, `${type}.markId`);
      decodeTextRange(operation.range, `${type}.range`);
      decodeTextStyleProperties(operation.resolvedProperties, `${type}.resolvedProperties`);
      break;
    case "row.insert":
      decodeDocumentRow(operation.row, `${type}.row`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "row.move":
      requireIdentifier(operation.rowId, `${type}.rowId`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "row.delete":
      requireIdentifier(operation.rowId, `${type}.rowId`);
      break;
    case "row.set-layout":
      requireIdentifier(operation.rowId, `${type}.rowId`);
      decodeRowLayout(operation.layout, `${type}.layout`);
      break;
    case "block.insert":
      decodeDocumentBlock(operation.block, `${type}.block`);
      decodePlacement(operation.placement, `${type}.placement`);
      break;
    case "block.move":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      decodePlacement(operation.placement, `${type}.placement`);
      break;
    case "block.replace":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      decodeDocumentBlock(operation.block, `${type}.block`);
      break;
    case "block.delete":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      break;
    case "block.set-style":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      requireIdentifier(operation.styleId, `${type}.styleId`);
      break;
    case "block.set-presentation":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      if (operation.presentation !== undefined) decodePresentation(operation.presentation, `${type}.presentation`);
      break;
    case "rich-text.apply":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      decodeRichTextOperations(operation.operations, `${type}.operations`);
      break;
    case "prompt.apply-derived-output": {
      requireIdentifier(operation.blockId, `${type}.blockId`);
      const output = requireRecord(operation.output, `${type}.output`);
      exactKeys(output, ["outputId", "appliedRevision"], `${type}.output`);
      requireIdentifier(output.outputId, `${type}.output.outputId`);
      if (!Number.isSafeInteger(output.appliedRevision) || (output.appliedRevision as number) <= 0) {
        throw new DocumentWireError(`${type}.output.appliedRevision must be a positive integer`);
      }
      break;
    }
    case "list.insert-item":
      requireIdentifier(operation.listId, `${type}.listId`);
      optionalIdentifier(operation.parentItemId, `${type}.parentItemId`);
      decodeListItem(operation.item, `${type}.item`);
      optionalIdentifier(operation.afterItemId, `${type}.afterItemId`);
      break;
    case "list.move-item":
      requireIdentifier(operation.listId, `${type}.listId`);
      requireIdentifier(operation.itemId, `${type}.itemId`);
      optionalIdentifier(operation.parentItemId, `${type}.parentItemId`);
      optionalIdentifier(operation.afterItemId, `${type}.afterItemId`);
      break;
    case "list.delete-item":
      requireIdentifier(operation.listId, `${type}.listId`);
      requireIdentifier(operation.itemId, `${type}.itemId`);
      break;
    case "list.set-checked":
      requireIdentifier(operation.listId, `${type}.listId`);
      requireIdentifier(operation.itemId, `${type}.itemId`);
      requireBoolean(operation.checked, `${type}.checked`);
      break;
    case "table.insert-row":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      decodeTableRow(operation.row, `${type}.row`);
      requireCells(operation.cells, `${type}.cells`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "table.move-row":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      requireIdentifier(operation.rowId, `${type}.rowId`);
      optionalIdentifier(operation.afterRowId, `${type}.afterRowId`);
      break;
    case "table.delete-row":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      requireIdentifier(operation.rowId, `${type}.rowId`);
      break;
    case "table.insert-column":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      decodeTableColumn(operation.column, `${type}.column`);
      requireCells(operation.cells, `${type}.cells`);
      optionalIdentifier(operation.afterColumnId, `${type}.afterColumnId`);
      break;
    case "table.move-column":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      requireIdentifier(operation.columnId, `${type}.columnId`);
      optionalIdentifier(operation.afterColumnId, `${type}.afterColumnId`);
      break;
    case "table.delete-column":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      requireIdentifier(operation.columnId, `${type}.columnId`);
      break;
    case "table.merge":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      decodeTableMerge(operation.merge, `${type}.merge`);
      break;
    case "table.unmerge":
      requireIdentifier(operation.tableId, `${type}.tableId`);
      requireIdentifier(operation.mergeId, `${type}.mergeId`);
      break;
    case "image.set-source":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      decodeMediaSnapshotRef(operation.source, `${type}.source`);
      break;
    case "image.set-accessibility":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      requireText(operation.alt, `${type}.alt`);
      requireBoolean(operation.decorative, `${type}.decorative`);
      break;
    case "visual.set-dimensions":
      requireIdentifier(operation.blockId, `${type}.blockId`);
      decodeDimensions(operation.dimensions, `${type}.dimensions`);
      break;
  }

  return structuredClone(operation) as unknown as DocumentOperation;
};

export const decodeDocumentOperations = (value: unknown): DocumentOperation[] => {
  if (!Array.isArray(value)) throw new DocumentWireError("operations must be an array");
  if (value.length === 0) throw new DocumentWireError("operations must not be empty");
  if (value.length > DOCUMENT_WIRE_LIMITS.maxOperations) {
    throw new DocumentWireError("operations exceeds the operation limit");
  }
  return value.map(decodeDocumentOperation);
};

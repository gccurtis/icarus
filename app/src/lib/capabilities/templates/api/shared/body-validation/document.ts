import {
  collectBlocksIdentifiers,
  validBlock
} from "$capabilities/templates/api/shared/body-validation/blocks";
import {
  validFormat,
  validStyles
} from "$capabilities/templates/api/shared/body-validation/formats";
import { validPage } from "$capabilities/templates/api/shared/body-validation/page";
import {
  type Fields,
  MAX_BLOCKS_PER_CONTAINER,
  addUniqueIdentifier,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  validIdentifier,
  validInteger,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";
import { MAX_TEMPLATE_ROWS } from "$capabilities/templates/api/shared/spreadsheet-address";

const validDocumentRow = (candidate: unknown): boolean => {
  if (!isRecord(candidate) || !validIdentifier(candidate.id)) return false;
  if (candidate.kind === "blocks") {
    if (
      !hasOnlyKeys(candidate, ["id", "kind", "blocks", "proportions"]) ||
      !Array.isArray(candidate.blocks) ||
      candidate.blocks.length > MAX_BLOCKS_PER_CONTAINER ||
      !candidate.blocks.every((block) => validBlock(block))
    ) {
      return false;
    }
    return (
      candidate.proportions === undefined ||
      (Array.isArray(candidate.proportions) &&
        candidate.proportions.length === candidate.blocks.length &&
        candidate.proportions.every(
          (proportion) => isFiniteNumber(proportion) && proportion > 0
        ))
    );
  }
  if (candidate.kind === "divider") {
    return (
      hasOnlyKeys(candidate, ["id", "kind", "color", "width", "style"]) &&
      (candidate.color === undefined || validText(candidate.color, 1_000)) &&
      (candidate.width === undefined ||
        (isFiniteNumber(candidate.width) && candidate.width > 0 && candidate.width <= 1_000)) &&
      (candidate.style === undefined ||
        ["solid", "dashed", "dotted"].includes(candidate.style as string))
    );
  }
  return candidate.kind === "pageBreak" && hasOnlyKeys(candidate, ["id", "kind"]);
};

const validDocumentRows = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_TEMPLATE_ROWS &&
  value.every(validDocumentRow) &&
  new Set(value.map((row) => (row as Fields).id)).size === value.length;

const validPageNumber = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["position", "format", "startAt", "hideOnFirstPage"]) &&
  ["start", "center", "end"].includes(value.position as string) &&
  (value.format === undefined || validText(value.format, 1_000, true)) &&
  (value.startAt === undefined || validInteger(value.startAt, 1, 1_000_000)) &&
  (value.hideOnFirstPage === undefined || typeof value.hideOnFirstPage === "boolean");

const validFurniture = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["rows", "firstPageRows", "distanceFromEdge", "pageNumber"]) &&
  validDocumentRows(value.rows) &&
  (value.firstPageRows === undefined || validDocumentRows(value.firstPageRows)) &&
  isFiniteNumber(value.distanceFromEdge) &&
  value.distanceFromEdge >= 0 &&
  value.distanceFromEdge <= 100 &&
  (value.pageNumber === undefined || validPageNumber(value.pageNumber));

const collectDocumentRowsIdentifiers = (rows: unknown[], seen: Set<string>): boolean =>
  rows.every((row) => {
    const fields = row as Fields;
    return (
      addUniqueIdentifier(seen, fields.id) &&
      (fields.kind !== "blocks" || collectBlocksIdentifiers(fields.blocks as unknown[], seen))
    );
  });

const collectFurnitureIdentifiers = (value: unknown, seen: Set<string>): boolean => {
  if (!isRecord(value)) return true;
  return (
    collectDocumentRowsIdentifiers(value.rows as unknown[], seen) &&
    (value.firstPageRows === undefined ||
      collectDocumentRowsIdentifiers(value.firstPageRows as unknown[], seen))
  );
};

export const validDocument = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, ["resource", "pageSetup", "styles", "rows", "header", "footer"]) ||
    !validDocumentRows(body.rows) ||
    (body.pageSetup !== undefined && !validPage(body.pageSetup)) ||
    (body.styles !== undefined && !validStyles(body.styles)) ||
    (body.header !== undefined && !validFurniture(body.header)) ||
    (body.footer !== undefined && !validFurniture(body.footer))
  ) {
    return false;
  }
  const identifiers = new Set<string>();
  return (
    collectDocumentRowsIdentifiers(body.rows as unknown[], identifiers) &&
    collectFurnitureIdentifiers(body.header, identifiers) &&
    collectFurnitureIdentifiers(body.footer, identifiers)
  );
};

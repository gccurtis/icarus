import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import {
  isStoredDocumentStyles,
  isStoredPageSetup
} from "$representation/data/behavior/content/stored-format";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredNatural,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type {
  DocumentBody,
  DocumentRow,
  PageFurniture,
  PageNumbering
} from "$representation/data/types/documents/body";

export const isStoredDocumentRow = (value: unknown): value is DocumentRow => {
  const row = storedFields(value);
  if (row === undefined || !isStoredIdentifier(row.id)) return false;
  if (row.kind === "blocks") {
    return hasExactFields(row, ["id", "kind", "blocks"], ["proportions"]) &&
      admitContentBlocks(row.blocks) !== undefined &&
      (row.proportions === undefined || (
        Array.isArray(row.proportions) &&
        row.proportions.every(isStoredFinite) &&
        row.proportions.length === (row.blocks as readonly unknown[]).length
      ));
  }
  if (row.kind === "divider") {
    return hasExactFields(row, ["id", "kind"], ["color", "width", "style"]) &&
      (row.color === undefined || isStoredText(row.color, 10_000)) &&
      (row.width === undefined || isStoredFinite(row.width)) &&
      (row.style === undefined || row.style === "solid" || row.style === "dashed" || row.style === "dotted");
  }
  return row.kind === "pageBreak" && hasExactFields(row, ["id", "kind"]);
};

const isStoredPageNumbering = (value: unknown): value is PageNumbering => {
  const numbering = storedFields(value);
  return numbering !== undefined &&
    hasExactFields(
      numbering,
      ["position"],
      ["format", "startAt", "hideOnFirstPage"]
    ) &&
    (numbering.position === "start" || numbering.position === "center" || numbering.position === "end") &&
    (numbering.format === undefined || isStoredText(numbering.format, 10_000)) &&
    (numbering.startAt === undefined || isStoredNatural(numbering.startAt)) &&
    (numbering.hideOnFirstPage === undefined || typeof numbering.hideOnFirstPage === "boolean");
};

const isStoredFurniture = (value: unknown): value is PageFurniture => {
  const furniture = storedFields(value);
  return furniture !== undefined &&
    hasExactFields(furniture, ["rows", "distanceFromEdge"], ["firstPageRows", "pageNumber"]) &&
    Array.isArray(furniture.rows) &&
    furniture.rows.every(isStoredDocumentRow) &&
    (furniture.firstPageRows === undefined || (
      Array.isArray(furniture.firstPageRows) && furniture.firstPageRows.every(isStoredDocumentRow)
    )) &&
    isStoredFinite(furniture.distanceFromEdge) &&
    (furniture.pageNumber === undefined || isStoredPageNumbering(furniture.pageNumber));
};

export const isStoredDocumentBody = (value: unknown): value is DocumentBody => {
  const body = storedFields(value);
  return body !== undefined &&
    hasExactFields(body, ["rows"], ["pageSetup", "styles", "header", "footer"]) &&
    Array.isArray(body.rows) &&
    body.rows.every(isStoredDocumentRow) &&
    (body.pageSetup === undefined || isStoredPageSetup(body.pageSetup)) &&
    (body.styles === undefined || isStoredDocumentStyles(body.styles)) &&
    (body.header === undefined || isStoredFurniture(body.header)) &&
    (body.footer === undefined || isStoredFurniture(body.footer));
};

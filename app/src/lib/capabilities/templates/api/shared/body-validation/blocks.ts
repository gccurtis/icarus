import { isStoredRowId } from "$representation/data/behavior/core/stored";
import { validTemplatedResourceSet } from "$capabilities/templates/api/shared/hole-validation";
import { MAX_TEMPLATE_COLUMNS } from "$capabilities/templates/api/shared/spreadsheet-address";
import { validFormat } from "$capabilities/templates/api/shared/body-validation/formats";
import { validFormulaValue } from "$capabilities/templates/api/shared/body-validation/formula-values";
import {
  displayOfAtoms,
  validAtom,
  validMarks,
  validPromptHole
} from "$capabilities/templates/api/shared/body-validation/inline-content";
import {
  type Fields,
  MAX_BLOCKS_PER_CONTAINER,
  MAX_BLOCK_TEXT_LENGTH,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validIdentifier,
  validInteger,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";

export const validBlock = (value: unknown, depth = 0): boolean => {
  if (depth > 12 || !isRecord(value) || !validIdentifier(value.id) || !isText(value.type)) {
    return false;
  }
  if (value.type === "text") {
    if (
      !hasOnlyKeys(value, [
        "id",
        "type",
        "variant",
        "level",
        "listStyle",
        "checked",
        "language",
        "style",
        "atoms",
        "display",
        "marks",
        "resolvedAt",
        "format"
      ]) ||
      !["paragraph", "heading", "list", "quote", "code"].includes(value.variant as string) ||
      !Array.isArray(value.atoms) ||
      value.atoms.length > MAX_BLOCKS_PER_CONTAINER ||
      !value.atoms.every(validAtom) ||
      !validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) ||
      value.display !== displayOfAtoms(value.atoms) ||
      !validMarks(value.marks, value.atoms)
    ) {
      return false;
    }
    if (value.level !== undefined && !validInteger(value.level, 1, 9)) return false;
    if (
      value.listStyle !== undefined &&
      !["bullet", "ordered", "todo"].includes(value.listStyle as string)
    ) {
      return false;
    }
    return (
      (value.checked === undefined || typeof value.checked === "boolean") &&
      (value.language === undefined || validText(value.language, 500, true)) &&
      (value.style === undefined || validIdentifier(value.style)) &&
      (value.resolvedAt === undefined || (isFiniteNumber(value.resolvedAt) && value.resolvedAt >= 0)) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "formula") {
    return (
      hasOnlyKeys(value, [
        "id",
        "type",
        "expression",
        "formulaId",
        "display",
        "value",
        "state",
        "format"
      ]) &&
      validText(value.expression, 10_000) &&
      (value.formulaId === undefined || isStoredRowId(value.formulaId, "formulas")) &&
      validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) &&
      validFormulaValue(value.value) &&
      value.state === "fresh" &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "image") {
    if (
      !hasOnlyKeys(value, ["id", "type", "source", "alt", "caption", "crop", "format"]) ||
      !validText(value.alt, 10_000, true)
    ) {
      return false;
    }
    if (value.source !== undefined) {
      if (!isRecord(value.source) || !isText(value.source.kind)) return false;
      if (value.source.kind === "url") {
        if (!hasOnlyKeys(value.source, ["kind", "url"]) || !validText(value.source.url, 10_000)) {
          return false;
        }
      } else if (value.source.kind === "file") {
        if (!hasOnlyKeys(value.source, ["kind", "fileId"]) || !validIdentifier(value.source.fileId)) {
          return false;
        }
      } else if (
        value.source.kind !== "storage" ||
        !hasOnlyKeys(value.source, ["kind", "storageId"]) ||
        !validIdentifier(value.source.storageId)
      ) {
        return false;
      }
    }
    if (
      value.caption !== undefined &&
      (!isRecord(value.caption) || value.caption.type !== "text" || !validBlock(value.caption, depth + 1))
    ) {
      return false;
    }
    if (value.crop !== undefined) {
      const crop = value.crop;
      if (
        !isRecord(crop) ||
        !hasOnlyKeys(crop, ["x", "y", "width", "height"]) ||
        !["x", "y", "width", "height"].every(
          (key) =>
            isFiniteNumber(crop[key]) &&
            (crop[key] as number) >= 0 &&
            (crop[key] as number) <= 1
        ) ||
        (crop.x as number) + (crop.width as number) > 1 ||
        (crop.y as number) + (crop.height as number) > 1
      ) {
        return false;
      }
    }
    return value.format === undefined || validFormat(value.format);
  }
  if (value.type === "table") {
    if (
      !hasOnlyKeys(value, ["id", "type", "rows", "headerRows", "columnWidths", "format"]) ||
      !Array.isArray(value.rows) ||
      value.rows.length > 1_000 ||
      !validInteger(value.headerRows, 0, value.rows.length)
    ) {
      return false;
    }
    const widths = value.columnWidths;
    if (
      widths !== undefined &&
      (!Array.isArray(widths) ||
        widths.length > MAX_TEMPLATE_COLUMNS ||
        !widths.every((width) => isFiniteNumber(width) && width > 0 && width <= 10_000))
    ) {
      return false;
    }
    return (
      value.rows.every(
        (row) =>
          isRecord(row) &&
          hasOnlyKeys(row, ["id", "cells"]) &&
          validIdentifier(row.id) &&
          Array.isArray(row.cells) &&
          row.cells.length <= MAX_TEMPLATE_COLUMNS &&
          row.cells.every(
            (cell) =>
              isRecord(cell) &&
              hasOnlyKeys(cell, ["id", "blocks", "rowSpan", "columnSpan", "format"]) &&
              validIdentifier(cell.id) &&
              Array.isArray(cell.blocks) &&
              cell.blocks.length <= MAX_BLOCKS_PER_CONTAINER &&
              cell.blocks.every((block) => validBlock(block, depth + 1)) &&
              (cell.rowSpan === undefined || validInteger(cell.rowSpan, 1, 1_000)) &&
              (cell.columnSpan === undefined || validInteger(cell.columnSpan, 1, MAX_TEMPLATE_COLUMNS)) &&
              (cell.format === undefined || validFormat(cell.format))
          )
      ) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "prompt") {
    return (
      hasOnlyKeys(value, [
        "id",
        "type",
        "style",
        "atoms",
        "display",
        "marks",
        "scope",
        "prompt",
        "hole",
        "state",
        "format"
      ]) &&
      (value.style === undefined || validIdentifier(value.style)) &&
      validText(value.prompt, MAX_BLOCK_TEXT_LENGTH) &&
      value.prompt.trim().length > 0 &&
      (value.hole === undefined || validPromptHole(value.hole)) &&
      Array.isArray(value.atoms) &&
      value.atoms.length <= MAX_BLOCKS_PER_CONTAINER &&
      value.atoms.every(validAtom) &&
      validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) &&
      value.display === displayOfAtoms(value.atoms) &&
      validMarks(value.marks, value.atoms) &&
      (value.scope === undefined || validTemplatedResourceSet(value.scope)) &&
      value.state === "idle" &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  return false;
};

const addUniqueIdentifier = (seen: Set<string>, value: unknown): boolean => {
  if (!isText(value) || seen.has(value)) return false;
  seen.add(value);
  return true;
};

export const collectBlockIdentifiers = (value: Fields, seen: Set<string>): boolean => {
  if (!addUniqueIdentifier(seen, value.id)) return false;
  if (value.type === "text" || value.type === "prompt") {
    for (const atom of value.atoms as Fields[]) {
      if (!addUniqueIdentifier(seen, atom.id)) return false;
    }
    for (const mark of value.marks as Fields[]) {
      if (!addUniqueIdentifier(seen, mark.id)) return false;
    }
  }
  if (value.type === "image" && isRecord(value.caption)) {
    if (!collectBlockIdentifiers(value.caption, seen)) return false;
  }
  if (value.type === "table") {
    for (const row of value.rows as Fields[]) {
      if (!addUniqueIdentifier(seen, row.id)) return false;
      for (const cell of row.cells as Fields[]) {
        if (!addUniqueIdentifier(seen, cell.id)) return false;
        for (const block of cell.blocks as Fields[]) {
          if (!collectBlockIdentifiers(block, seen)) return false;
        }
      }
    }
  }
  return true;
};

export const collectBlocksIdentifiers = (value: unknown[], seen: Set<string>): boolean =>
  value.every((block) => collectBlockIdentifiers(block as Fields, seen));

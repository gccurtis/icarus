import {
  MAX_TEMPLATE_CELLS,
  MAX_TEMPLATE_COLUMNS,
  MAX_TEMPLATE_FORMAT_RULES,
  MAX_TEMPLATE_ROWS,
  templateAddress,
  templateColumnNumber,
  validTemplateAddress,
  validTemplateColumnSelection,
  validTemplateRowSelection
} from "$capabilities/templates/api/shared/spreadsheet-address";
import {
  validCellFormat,
  validCellStyles
} from "$capabilities/templates/api/shared/body-validation/formats";
import { validMarks } from "$capabilities/templates/api/shared/body-validation/inline-content";
import { validPage } from "$capabilities/templates/api/shared/body-validation/page";
import {
  type Fields,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validIdentifier,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";
import { validVariableValue } from "$capabilities/templates/api/shared/body-validation/formula-values";

const validSize = (value: unknown): boolean =>
  isFiniteNumber(value) && value > 0 && value <= 10_000;

const orderedAddressRange = (from: string, to: string): boolean => {
  const start = templateAddress(from);
  const end = templateAddress(to);
  if (start === undefined || end === undefined) return false;
  const startColumn = templateColumnNumber(start.column);
  const endColumn = templateColumnNumber(end.column);
  return (
    startColumn !== undefined &&
    endColumn !== undefined &&
    end.row >= start.row &&
    endColumn >= startColumn
  );
};

const orderedRowSelection = (value: string): boolean =>
  validTemplateRowSelection(value) &&
  value.split(",").every((part) => {
    const [from, to] = part.trim().split(":");
    return to === undefined || Number(to) >= Number(from);
  });

const orderedColumnSelection = (value: string): boolean =>
  validTemplateColumnSelection(value) &&
  value.split(",").every((part) => {
    const [from, to] = part.trim().split(":");
    const start = templateColumnNumber(from);
    const end = to === undefined ? start : templateColumnNumber(to);
    return start !== undefined && end !== undefined && end >= start;
  });

export const validSpreadsheet = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, [
      "resource",
      "cells",
      "columnWidths",
      "rowHeights",
      "formatRules",
      "frozenRows",
      "frozenColumns",
      "print",
      "styles"
    ]) ||
    !isRecord(body.cells) ||
    Object.keys(body.cells).length > MAX_TEMPLATE_CELLS
  ) {
    return false;
  }
  if (
    !Object.entries(body.cells).every(
      ([address, cell]) => {
        if (
          !validTemplateAddress(address) ||
          !isRecord(cell) ||
          !hasOnlyKeys(cell, ["value", "expression", "marks", "format", "merge"])
        ) {
          return false;
        }
        if (
          cell.expression !== undefined &&
          !validText(cell.expression, 10_000)
        ) {
          return false;
        }
        if (cell.merge !== undefined) {
          if (
            !isText(cell.merge) ||
            !validTemplateAddress(cell.merge) ||
            !orderedAddressRange(address, cell.merge)
          ) {
            return false;
          }
        }
        return (
          (cell.marks === undefined || validMarks(cell.marks)) &&
          (cell.format === undefined || validCellFormat(cell.format)) &&
          (cell.value === undefined || validVariableValue(cell.value))
        );
      }
    )
  ) {
    return false;
  }
  if (
    body.columnWidths !== undefined &&
    (!isRecord(body.columnWidths) ||
      Object.keys(body.columnWidths).length > MAX_TEMPLATE_COLUMNS ||
      !Object.entries(body.columnWidths).every(
        ([label, width]) =>
          label === label.toUpperCase() && templateColumnNumber(label) !== undefined && validSize(width)
      ))
  ) {
    return false;
  }
  if (
    body.rowHeights !== undefined &&
    (!isRecord(body.rowHeights) ||
      Object.keys(body.rowHeights).length > MAX_TEMPLATE_ROWS ||
      !Object.entries(body.rowHeights).every(
        ([label, height]) =>
          /^[1-9][0-9]*$/.test(label) && Number(label) <= MAX_TEMPLATE_ROWS && validSize(height)
      ))
  ) {
    return false;
  }
  if (
    !Array.isArray(body.formatRules) ||
    body.formatRules.length > MAX_TEMPLATE_FORMAT_RULES ||
    !body.formatRules.every(
      (rule) =>
        isRecord(rule) &&
        hasOnlyKeys(rule, ["id", "from", "to", "style", "format"]) &&
        validIdentifier(rule.id) &&
        isText(rule.from) &&
        validTemplateAddress(rule.from) &&
        isText(rule.to) &&
        validTemplateAddress(rule.to) &&
        orderedAddressRange(rule.from, rule.to) &&
        (rule.style === undefined || validIdentifier(rule.style)) &&
        (rule.format === undefined || validCellFormat(rule.format))
    )
  ) {
    return false;
  }
  if (
    !isRecord(body.print) ||
    !hasOnlyKeys(body.print, [
      "page",
      "area",
      "repeatRows",
      "repeatColumns",
      "scale",
      "gridlines",
      "headings"
    ]) ||
    !validPage(body.print.page)
  ) {
    return false;
  }
  const print = body.print;
  if (
    print.area !== undefined &&
    (!isRecord(print.area) ||
      !hasOnlyKeys(print.area, ["from", "to"]) ||
      Object.keys(print.area).length !== 2 ||
      !isText(print.area.from) ||
      !validTemplateAddress(print.area.from) ||
      !isText(print.area.to) ||
      !validTemplateAddress(print.area.to) ||
      !orderedAddressRange(print.area.from, print.area.to))
  ) {
    return false;
  }
  if (
    print.repeatRows !== undefined &&
    (!isText(print.repeatRows) || !orderedRowSelection(print.repeatRows))
  ) {
    return false;
  }
  if (
    print.repeatColumns !== undefined &&
    (!isText(print.repeatColumns) || !orderedColumnSelection(print.repeatColumns))
  ) {
    return false;
  }
  if (
    print.scale !== undefined &&
    print.scale !== "fit-width" &&
    print.scale !== "fit-page" &&
    !(isFiniteNumber(print.scale) && print.scale > 0 && print.scale <= 10_000)
  ) {
    return false;
  }
  if (print.gridlines !== undefined && typeof print.gridlines !== "boolean") return false;
  if (print.headings !== undefined && typeof print.headings !== "boolean") return false;
  if (
    body.frozenRows !== undefined &&
    (!Number.isInteger(body.frozenRows) ||
      (body.frozenRows as number) < 0 ||
      (body.frozenRows as number) > MAX_TEMPLATE_ROWS)
  ) {
    return false;
  }
  if (
    body.frozenColumns !== undefined &&
    (!Number.isInteger(body.frozenColumns) ||
      (body.frozenColumns as number) < 0 ||
      (body.frozenColumns as number) > MAX_TEMPLATE_COLUMNS)
  ) {
    return false;
  }
  return validCellStyles(body.styles);
};

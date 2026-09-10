import {
  currentFormulaValue,
  currentMark
} from "$representation/data/behavior/content/admission";
import {
  isStoredCellFormat,
  isStoredPageSetup,
  isStoredSpreadsheetStyles
} from "$representation/data/behavior/content/stored-format";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredNatural,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { SpreadsheetTemplate } from "$representation/data/types/templates/template";

const address = (value: unknown): value is string =>
  isStoredText(value, 32) && /^[A-Z]+[1-9][0-9]*$/.test(value);

const positiveSize = (value: unknown): boolean =>
  isStoredFinite(value) && value > 0 && value <= 10_000;

const sizedMap = (value: unknown, keys: (key: string) => boolean): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    Object.entries(held).every(([key, size]) => keys(key) && positiveSize(size));
};

const cell = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    hasExactFields(held, [], ["value", "expression", "marks", "format", "merge"]) &&
    (held.value === undefined || currentFormulaValue(held.value)) &&
    (held.expression === undefined || isStoredText(held.expression, 10_000)) &&
    (held.marks === undefined || (Array.isArray(held.marks) && held.marks.every(currentMark))) &&
    (held.format === undefined || isStoredCellFormat(held.format)) &&
    (held.merge === undefined || address(held.merge));
};

const formatRule = (value: unknown): boolean => {
  const rule = storedFields(value);
  return rule !== undefined &&
    hasExactFields(rule, ["id", "from", "to"], ["style", "format"]) &&
    isStoredIdentifier(rule.id) &&
    address(rule.from) &&
    address(rule.to) &&
    (rule.style === undefined || isStoredIdentifier(rule.style)) &&
    (rule.format === undefined || isStoredCellFormat(rule.format));
};

const print = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined || !hasExactFields(
    held,
    ["page"],
    ["area", "repeatRows", "repeatColumns", "scale", "gridlines", "headings"]
  ) || !isStoredPageSetup(held.page)) return false;
  const area = held.area === undefined ? undefined : storedFields(held.area);
  return (area === undefined ? held.area === undefined : (
    hasExactFields(area, ["from", "to"]) && address(area.from) && address(area.to)
  )) &&
    (held.repeatRows === undefined || (
      isStoredText(held.repeatRows, 10_000) && /^[1-9][0-9]*(?::[1-9][0-9]*)?(?:,[1-9][0-9]*(?::[1-9][0-9]*)?)*$/.test(held.repeatRows)
    )) &&
    (held.repeatColumns === undefined || (
      isStoredText(held.repeatColumns, 10_000) && /^[A-Z]+(?::[A-Z]+)?(?:,[A-Z]+(?::[A-Z]+)?)*$/.test(held.repeatColumns)
    )) &&
    (held.scale === undefined || held.scale === "fit-width" || held.scale === "fit-page" || positiveSize(held.scale)) &&
    (held.gridlines === undefined || typeof held.gridlines === "boolean") &&
    (held.headings === undefined || typeof held.headings === "boolean");
};

/** Exact current spreadsheet template body after its `resource` discriminator is removed. */
export const isStoredSpreadsheetTemplate = (value: unknown): value is SpreadsheetTemplate => {
  const body = storedFields(value);
  const cells = storedFields(body?.cells);
  if (
    body === undefined ||
    !hasExactFields(
      body,
      ["cells", "formatRules", "print", "styles"],
      ["columnWidths", "rowHeights", "frozenRows", "frozenColumns"]
    ) ||
    cells === undefined ||
    !Object.entries(cells).every(([key, value]) => address(key) && cell(value)) ||
    (body.columnWidths !== undefined && !sizedMap(body.columnWidths, (key) => /^[A-Z]+$/.test(key))) ||
    (body.rowHeights !== undefined && !sizedMap(body.rowHeights, (key) => /^[1-9][0-9]*$/.test(key))) ||
    !Array.isArray(body.formatRules) ||
    !body.formatRules.every(formatRule) ||
    new Set((body.formatRules as Array<{ id: string }>).map((rule) => rule.id)).size !== body.formatRules.length ||
    !print(body.print) ||
    !isStoredSpreadsheetStyles(body.styles) ||
    (body.frozenRows !== undefined && !isStoredNatural(body.frozenRows)) ||
    (body.frozenColumns !== undefined && !isStoredNatural(body.frozenColumns))
  ) return false;
  const styleKeys = Object.keys((body.styles as { styles: Record<string, unknown> }).styles);
  return (body.formatRules as Array<{ style?: string }>).every(
    (rule) => rule.style === undefined || styleKeys.includes(rule.style)
  );
};

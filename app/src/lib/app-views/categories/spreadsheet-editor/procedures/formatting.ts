import type { CellFormat } from "$representation/data/types/spreadsheets/cell-format";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { FormatRule, SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { CellStyle } from "$representation/data/types/spreadsheets/style-set";
import {
  contains,
  indexOf,
  rectOf,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";

export type {
  BorderLine,
  BorderSide,
  BorderStyle,
  CellBorder,
  CellFormat
} from "$representation/data/types/spreadsheets/cell-format";
export { BORDER_SIDES, hasBorder } from "$representation/data/behavior/spreadsheets/borders";
export type { FormatRule } from "$representation/data/types/spreadsheets/body";
export type { CellStyle } from "$representation/data/types/spreadsheets/style-set";

export type Paint = {
  readonly styleKey: string;
  readonly style: CellStyle;
  readonly styleRule: FormatRule | undefined;
  readonly rules: readonly FormatRule[];
  readonly format: CellFormat;
  readonly own: CellFormat | undefined;
};

export const ruleRectOf = (grid: Grid, rule: FormatRule): Rect | undefined => rectOf(grid, rule);

export const rulesCovering = (body: SpreadsheetBody, grid: Grid, ref: CellRef): FormatRule[] => {
  const at = indexOf(grid, ref);
  if (at === undefined) return [];
  return body.formatRules.filter((rule) => {
    const rect = rectOf(grid, rule);
    return rect !== undefined && contains(rect, at.row, at.column);
  });
};

export const paintOf = (
  body: SpreadsheetBody,
  grid: Grid,
  ref: CellRef,
  cell: SheetCell | undefined
): Paint => {
  const rules = rulesCovering(body, grid, ref);
  let styleKey = body.styles.defaultKey;
  let styleRule: FormatRule | undefined;
  let format: CellFormat = {};
  for (const rule of rules) {
    if (rule.style !== undefined && body.styles.styles[rule.style] !== undefined) {
      styleKey = rule.style;
      styleRule = rule;
    }
    if (rule.format !== undefined) format = { ...format, ...rule.format };
  }
  if (cell?.format !== undefined) format = { ...format, ...cell.format };
  return {
    styleKey,
    style: body.styles.styles[styleKey] ?? { name: styleKey },
    styleRule,
    rules,
    format,
    own: cell?.format
  };
};

export const weightOf = (style: CellStyle): number => style.fontWeight ?? (style.bold ? 600 : 400);

export type Emphasis = {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikethrough: boolean;
};

export const emphasisOf = (paint: Paint): Emphasis => ({
  bold: paint.format.bold ?? (paint.style.bold === true || (paint.style.fontWeight ?? 0) >= 600),
  italic: paint.format.italic ?? paint.style.italic === true,
  underline: paint.format.underline ?? paint.style.underline === true,
  strikethrough: paint.format.strikethrough ?? paint.style.strikethrough === true
});

export const cellWeightOf = (paint: Paint): number =>
  paint.format.bold === undefined ? weightOf(paint.style) : paint.format.bold ? 600 : 400;

export const familyOf = (paint: Paint): string | undefined => paint.format.fontFamily ?? paint.style.fontFamily;

export const sizeOf = (paint: Paint): number | undefined => paint.format.fontSize ?? paint.style.fontSize;

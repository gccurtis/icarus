import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { FormatRule, SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { TextStyle } from "$representation/data/types/spreadsheets/style-set";
import {
  contains,
  indexOf,
  rectOf,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import type { ValueKind } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type { BlockFormat, Border, BorderLine, BorderSide, BorderStyle } from "$representation/data/types/content/block-format";
export { BORDER_SIDES, hasBorder } from "$representation/data/behavior/content/borders";
export type { FormatRule } from "$representation/data/types/spreadsheets/body";
export type { TextStyle } from "$representation/data/types/spreadsheets/style-set";

export type Paint = {
  readonly styleKey: string;
  readonly style: TextStyle;
  readonly styleRule: FormatRule | undefined;
  readonly rules: readonly FormatRule[];
  readonly format: BlockFormat;
  readonly own: BlockFormat | undefined;
};

export const FAMILIES = ["IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono", "Georgia"] as const;

export const DEFAULT_FONT_SIZE = 13;

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
  let format: BlockFormat = {};
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

export type Align = "left" | "center" | "right";

export const alignOf = (paint: Paint, kind: ValueKind): Align => {
  switch (paint.format.horizontalAlignment ?? paint.style.horizontalAlignment) {
    case "start":
    case "justify":
      return "left";
    case "center":
      return "center";
    case "end":
      return "right";
    default:
      return kind === "number" || kind === "date" ? "right" : kind === "logic" ? "center" : "left";
  }
};

export const weightOf = (style: TextStyle): number => style.fontWeight ?? (style.bold ? 600 : 400);

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

export const ALIGNMENTS = [
  { value: "start", label: "Left" },
  { value: "center", label: "Center" },
  { value: "end", label: "Right" }
] as const;

export const VERTICAL_ALIGNMENTS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" }
] as const;

export type Valign = "top" | "middle" | "bottom";

export const valignOf = (paint: Paint): Valign => paint.format.verticalAlignment ?? "middle";

import type { CellFormat } from "$representation/data/types/spreadsheets/cell-format";
import type { FormatRule, SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { CellStyle } from "$representation/data/types/spreadsheets/style-set";
import {
  rangeOf,
  rectOf,
  sameRect,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { rulesCovering } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";
import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/spans";

export type StyleRow = {
  readonly key: string;
  readonly style: CellStyle;
  readonly shorthand: string;
  readonly isDefault: boolean;
};

const ALIGN_WORD: Record<string, string> = { start: "start", center: "centred", end: "end", justify: "justified" };

export const shorthandOf = (style: CellStyle): string => {
  const parts: string[] = [];
  const weight = style.fontWeight ?? (style.bold ? 600 : undefined);
  if (weight !== undefined && weight !== 400) parts.push(String(weight));
  if (style.italic) parts.push("italic");
  if (style.underline) parts.push("underlined");
  if (style.horizontalAlignment !== undefined) parts.push(ALIGN_WORD[style.horizontalAlignment] ?? style.horizontalAlignment);
  if (style.fontSize !== undefined) parts.push(`${style.fontSize} px`);
  if (style.fontFamily !== undefined) parts.push(style.fontFamily);
  return parts.length === 0 ? "plain" : parts.join(" · ");
};

export const styleRows = (sheet: LiveSheet): StyleRow[] =>
  Object.entries(sheet.body.styles.styles).map(([key, style]) => ({
    key,
    style,
    shorthand: shorthandOf(style),
    isDefault: key === sheet.body.styles.defaultKey
  }));

const exactRule = (body: SpreadsheetBody, grid: Grid, rect: Rect): FormatRule | undefined =>
  [...body.formatRules].reverse().find((rule) => {
    const held = rectOf(grid, rule);
    return held !== undefined && sameRect(held, rect);
  });

export const appliedStyle = (body: SpreadsheetBody, grid: Grid, rects: readonly Rect[], key: string): SpreadsheetOp[] =>
  rects.flatMap((rect): SpreadsheetOp[] => {
    const range = rangeOf(grid, rect);
    if (range === undefined) return [];
    const exact = exactRule(body, grid, rect);
    if (exact !== undefined) {
      if (exact.style === key) return [];
      return [{ op: "set", target: "formatRule", path: `formatRules/${exact.id}/style`, value: key, was: exact.style ?? null }];
    }
    const id = mint("rule");
    return [
      {
        op: "insert",
        target: "formatRule",
        path: "formatRules",
        ids: [id],
        after: body.formatRules.at(-1)?.id ?? null,
        values: [{ id, from: range.from, to: range.to, style: key }]
      }
    ];
  });

export const ruleFormatOver = (
  body: SpreadsheetBody,
  grid: Grid,
  rects: readonly Rect[],
  field: keyof CellFormat,
  value: unknown
): SpreadsheetOp[] =>
  rects.flatMap((rect): SpreadsheetOp[] => {
    const range = rangeOf(grid, rect);
    if (range === undefined) return [];
    const exact = exactRule(body, grid, rect);
    if (exact !== undefined) {
      const was = exact.format?.[field] ?? null;
      if (JSON.stringify(was) === JSON.stringify(value ?? null)) return [];
      return [{ op: "set", target: "formatRule", path: `formatRules/${exact.id}/format/${field}`, value, was }];
    }
    if (value === null) return [];
    const id = mint("rule");
    return [
      {
        op: "insert",
        target: "formatRule",
        path: "formatRules",
        ids: [id],
        after: body.formatRules.at(-1)?.id ?? null,
        values: [{ id, from: range.from, to: range.to, format: { [field]: value } }]
      }
    ];
  });

const freshKey = (body: SpreadsheetBody, base: string): string => {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "style";
  if (body.styles.styles[root] === undefined) return root;
  let n = 2;
  while (body.styles.styles[`${root}-${n}`] !== undefined) n += 1;
  return `${root}-${n}`;
};

export const newStyle = (body: SpreadsheetBody, from?: CellStyle): { readonly ops: SpreadsheetOp[]; readonly key: string } => {
  const name = from === undefined ? "Untitled" : `${from.name} copy`;
  const key = freshKey(body, name);
  return {
    key,
    ops: [{ op: "insert", target: "sheet", path: "styles", ids: [key], after: null, values: [{ ...(from ?? {}), name }] }]
  };
};

export const deletedStyle = (body: SpreadsheetBody, key: string): Edit => {
  const held = body.styles.styles[key];
  if (held === undefined) return { ops: [] };
  if (body.styles.defaultKey === key) return { ops: [], refused: "The default style stays. Make another style the default first." };
  const users = body.formatRules.filter((rule) => rule.style === key).length;
  if (users > 0) return { ops: [], refused: `${users} ${users === 1 ? "rule still names" : "rules still name"} this style.` };
  return { ops: [{ op: "remove", target: "sheet", path: "styles", ids: [key], after: null, values: [held] }] };
};

export const madeDefault = (body: SpreadsheetBody, key: string): SpreadsheetOp | undefined =>
  body.styles.defaultKey === key || body.styles.styles[key] === undefined
    ? undefined
    : { op: "set", target: "sheet", path: "styles/defaultKey", value: key, was: body.styles.defaultKey };

export const setStyleField = (
  body: SpreadsheetBody,
  key: string,
  field: keyof CellStyle,
  value: unknown
): SpreadsheetOp | undefined => {
  const held = body.styles.styles[key];
  if (held === undefined) return undefined;
  const was = held[field] ?? null;
  if (JSON.stringify(was) === JSON.stringify(value ?? null)) return undefined;
  return { op: "set", target: "sheet", path: `styles/styles/${key}/${field}`, value, was };
};

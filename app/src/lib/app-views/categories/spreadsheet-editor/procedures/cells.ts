import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  indexOf,
  keyOf,
  refsIn,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  isAnchor,
  mergeSpans,
  spanCovering,
  spillMessage,
  spillSpans,
  type Edit
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { PLAIN, patternOf } from "$app-views/categories/spreadsheet-editor/procedures/number-format";
import { displayOf, parseTyped, sameValue } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/spans";

export const set = (path: string, value: unknown, was: unknown): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path,
  value,
  was
});

export const cellAt = (sheet: LiveSheet, ref: CellRef): SheetCell | undefined =>
  sheet.cells[keyOf(ref)];

export const hasShell = (cell: SheetCell): boolean =>
  cell.format !== undefined ||
  (cell.marks !== undefined && cell.marks.length > 0) ||
  cell.mergedTo !== undefined ||
  cell.spillTo !== undefined;

export const written = (sheet: LiveSheet, ref: CellRef, value: FormulaValue): SpreadsheetOp[] => {
  const key = keyOf(ref);
  const held = sheet.cells[key];
  if (held === undefined) return [set(key, { value }, null)];
  const ops: SpreadsheetOp[] = [];
  if (!sameValue(held.value, value)) ops.push(set(`${key}/value`, value, held.value));
  if (held.expression !== undefined) ops.push(set(`${key}/expression`, null, held.expression));
  return ops;
};

export const expressed = (sheet: LiveSheet, ref: CellRef, expression: string): SpreadsheetOp[] => {
  const key = keyOf(ref);
  const held = sheet.cells[key];
  if (held === undefined) return [set(key, { value: { kind: "empty" }, expression }, null)];
  if (held.expression === expression) return [];
  return [set(`${key}/expression`, expression, held.expression ?? null)];
};

export const setField = (
  sheet: LiveSheet,
  ref: CellRef,
  field: string,
  value: unknown
): SpreadsheetOp => {
  const key = keyOf(ref);
  const held = sheet.cells[key] as Record<string, unknown> | undefined;
  const parts = field.split("/");
  const was = parts.reduce<unknown>(
    (step, part) => (step !== null && typeof step === "object" ? (step as Record<string, unknown>)[part] : undefined),
    held
  );
  return set(`${key}/${field}`, value, was ?? null);
};

const clearOne = (key: string, held: SheetCell): SpreadsheetOp[] => {
  if (!hasShell(held)) return [set(key, null, held)];
  const ops: SpreadsheetOp[] = [];
  if (held.value.kind !== "empty") ops.push(set(`${key}/value`, { kind: "empty" }, held.value));
  if (held.expression !== undefined) ops.push(set(`${key}/expression`, null, held.expression));
  if (held.spillTo !== undefined) ops.push(set(`${key}/spillTo`, null, held.spillTo));
  return ops;
};

export const cleared = (sheet: LiveSheet, grid: Grid, refs: readonly CellRef[]): Edit => {
  const spills = spillSpans(sheet, grid);
  const merges = mergeSpans(sheet, grid);
  const ops: SpreadsheetOp[] = [];
  let skipped = 0;
  let cleared = 0;

  for (const ref of refs) {
    const key = keyOf(ref);
    const held = sheet.cells[key];
    if (held === undefined) continue;
    const at = indexOf(grid, ref);
    if (at !== undefined) {
      const spill = spanCovering(spills, at.row, at.column);
      const merge = spanCovering(merges, at.row, at.column);
      if (
        (spill !== undefined && !isAnchor(spill, at.row, at.column)) ||
        (merge !== undefined && !isAnchor(merge, at.row, at.column))
      ) {
        skipped += 1;
        continue;
      }
    }
    ops.push(...clearOne(key, held));
    cleared += 1;
  }

  return { ops, skipped, cleared };
};

export const typed = (sheet: LiveSheet, grid: Grid, ref: CellRef, text: string): Edit => {
  const at = indexOf(grid, ref);
  if (at === undefined) return { ops: [], refused: "That coordinate is off the grid." };

  const spill = spanCovering(spillSpans(sheet, grid), at.row, at.column);
  if (spill !== undefined && !isAnchor(spill, at.row, at.column)) {
    const origin = sheet.cells[keyOf(spill.anchor)];
    return { ops: [], refused: spillMessage(grid, ref, spill, origin?.expression) };
  }
  const merge = spanCovering(mergeSpans(sheet, grid), at.row, at.column);
  if (merge !== undefined && !isAnchor(merge, at.row, at.column)) {
    return { ops: [], refused: "That coordinate sits under a merge. Type into the merged cell." };
  }

  const parsed = parseTyped(text);
  if (parsed.kind === "clear") return cleared(sheet, grid, [ref]);
  if (parsed.kind === "expression") return { ops: expressed(sheet, ref, parsed.expression) };

  const ops = written(sheet, ref, parsed.value);
  const held = sheet.cells[keyOf(ref)];
  if (parsed.value.kind === "number" && paintOf(sheet.body, grid, ref, held).format.valueFormat === undefined) {
    const pattern = patternTyped(text, parsed.value.value);
    if (pattern !== null) ops.push(setField(sheet, ref, "format/valueFormat", pattern));
  }
  return { ops };
};

const TYPED = /^(-?)([$€£¥]?)([\d,]+)(?:\.(\d+))?$/;

export const patternTyped = (text: string, value: number): string | null => {
  const match = TYPED.exec(text.trim());
  if (match === null) return null;
  const [, , prefix, whole, fraction] = match;
  const figures = fraction?.length ?? 0;
  const natural = (String(Math.abs(value)).split(".")[1] ?? "").length;
  const thousands = whole.includes(",") ? "," : "none";
  if (figures <= natural && prefix === "" && thousands === "none") return null;
  return patternOf({ ...PLAIN, prefix, decimals: Math.max(figures, natural), thousands });
};

export type CellKind = "number" | "text" | "logic" | "date";

const asKind = (value: FormulaValue, kind: CellKind): FormulaValue | undefined => {
  if (value.kind === kind) return value;
  const text = value.kind === "text" ? value.value : value.kind === "number" ? String(value.value) : value.kind === "logic" ? String(value.value) : "";
  switch (kind) {
    case "text":
      return { kind: "text", value: text };
    case "number": {
      const parsed = parseTyped(text);
      return parsed.kind === "value" && parsed.value.kind === "number" ? parsed.value : undefined;
    }
    case "logic": {
      if (value.kind === "number") return { kind: "logic", value: value.value !== 0 };
      const word = text.trim().toLowerCase();
      return word === "true" || word === "1" || word === "yes" ? { kind: "logic", value: true } : word === "false" || word === "0" || word === "no" || word === "" ? { kind: "logic", value: false } : undefined;
    }
    case "date": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
      if (match === null) return undefined;
      const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
      return { kind: "date", value: { calendar: "gregorian", year, month, day, utc: Date.UTC(year, month - 1, day) } };
    }
  }
};

export const coerced = (sheet: LiveSheet, ref: CellRef, kind: CellKind): Edit => {
  const key = keyOf(ref);
  const held = sheet.cells[key];
  if (held === undefined || held.value.kind === "reference") return { ops: [] };
  const next = asKind(held.value, kind);
  if (next === undefined) return { ops: [], refused: `${displayOf(held.value)} does not read as a ${kind}.` };
  if (sameValue(held.value, next)) return { ops: [] };
  return { ops: [set(`${key}/value`, next, held.value)] };
};

export const populatedIn = (sheet: LiveSheet, grid: Grid, rect: Rect): SheetCell[] =>
  refsIn(grid, rect).flatMap((ref) => {
    const held = sheet.cells[keyOf(ref)];
    return held === undefined ? [] : [held];
  });

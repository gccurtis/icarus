import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  indexOf,
  keyOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  isAnchor,
  spanCovering,
  type Edit
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { mergeSpans } from "$app-views/categories/spreadsheet-editor/procedures/merge-spans";
import { spillMessage, spillSpans } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
import {
  toStored,
  type SheetFacts,
  type Translated
} from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { patternTyped } from "$app-views/categories/spreadsheet-editor/procedures/typed-pattern";
import { parseTyped, sameValue } from "$app-views/categories/spreadsheet-editor/procedures/values";

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
  if (held.anchors !== undefined) ops.push(set(`${key}/anchors`, null, held.anchors));
  if (held.failure !== undefined) ops.push(set(`${key}/failure`, null, held.failure));
  return ops;
};

export const expressed = (sheet: LiveSheet, ref: CellRef, formula: Translated): SpreadsheetOp[] => {
  const key = keyOf(ref);
  const held = sheet.cells[key];
  const anchors = [...formula.anchors];
  if (held === undefined) {
    return [set(key, { value: { kind: "empty" }, expression: formula.formula, anchors }, null)];
  }
  const ops: SpreadsheetOp[] = [];
  if (held.expression !== formula.formula) {
    ops.push(set(`${key}/expression`, formula.formula, held.expression ?? null));
  }
  if (JSON.stringify(held.anchors ?? []) !== JSON.stringify(anchors)) {
    ops.push(set(`${key}/anchors`, anchors, held.anchors ?? null));
  }
  return ops;
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

export const typed = (
  sheet: LiveSheet,
  grid: Grid,
  ref: CellRef,
  text: string,
  facts: SheetFacts,
  byTitle?: (title: string) => SheetFacts | undefined
): Edit => {
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
  if (parsed.kind === "expression") {
    return { ops: expressed(sheet, ref, toStored(parsed.expression, facts, byTitle)) };
  }

  const ops = written(sheet, ref, parsed.value);
  const held = sheet.cells[keyOf(ref)];
  if (parsed.value.kind === "number" && paintOf(sheet.body, grid, ref, held).format.valueFormat === undefined) {
    const pattern = patternTyped(text, parsed.value.value);
    if (pattern !== null) ops.push(setField(sheet, ref, "format/valueFormat", pattern));
  }
  return { ops };
};

import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  keyOf,
  refAt,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { written } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import {
  isAnchor,
  mergeSpans,
  spanCovering,
  spillSpans,
  type Edit
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Filled = Edit & { readonly summary?: string };

type Lane = { readonly pattern: readonly (FormulaValue | undefined)[]; readonly targets: readonly (readonly [number, number])[]; readonly forward: boolean };

const TRAILING = /^(.*?)(\d+)$/;

const numbersOf = (pattern: readonly (FormulaValue | undefined)[]): number[] | undefined => {
  const numbers = pattern.map((value) => (value?.kind === "number" ? value.value : undefined));
  return numbers.every((value): value is number => value !== undefined) ? numbers : undefined;
};

const stepOf = (numbers: readonly number[]): number | undefined => {
  if (numbers.length < 2) return undefined;
  const step = numbers[1] - numbers[0];
  return numbers.every((value, index) => index === 0 || Math.abs(value - numbers[index - 1] - step) < 1e-9)
    ? step
    : undefined;
};

const countedText = (pattern: readonly (FormulaValue | undefined)[]): { prefix: string; last: number; width: number } | undefined => {
  if (pattern.length !== 1 || pattern[0]?.kind !== "text") return undefined;
  const match = TRAILING.exec(pattern[0].value);
  return match === null ? undefined : { prefix: match[1], last: Number(match[2]), width: match[2].length };
};

const seriesOf = (lane: Lane): { values: FormulaValue[]; word: string } => {
  const { pattern, targets, forward } = lane;
  const count = targets.length;
  const numbers = numbersOf(pattern);
  const step = numbers === undefined ? undefined : stepOf(numbers);

  if (numbers !== undefined && step !== undefined) {
    const anchor = forward ? numbers[numbers.length - 1] : numbers[0];
    const values = Array.from({ length: count }, (_, index) => ({
      kind: "number" as const,
      value: Math.round((anchor + (forward ? 1 : -1) * step * (index + 1)) * 1e9) / 1e9
    }));
    return { values: forward ? values : values.reverse(), word: "Series" };
  }

  const counted = countedText(pattern);
  if (counted !== undefined) {
    const values = Array.from({ length: count }, (_, index) => ({
      kind: "text" as const,
      value: `${counted.prefix}${String(counted.last + (forward ? 1 : -1) * (index + 1)).padStart(counted.width, "0")}`
    }));
    return { values: forward ? values : values.reverse(), word: "Counted" };
  }

  const values = Array.from({ length: count }, (_, index) => {
    const at = forward ? index % pattern.length : (pattern.length - 1 - (index % pattern.length) + pattern.length) % pattern.length;
    return pattern[at] ?? { kind: "empty" as const };
  });
  return { values: forward ? values : values.reverse(), word: pattern.length === 1 ? "Repeated" : "Pattern" };
};

const lanesOf = (sheet: LiveSheet, grid: Grid, source: Rect, target: Rect): Lane[] | undefined => {
  const cellOf = (row: number, column: number): FormulaValue | undefined => {
    const ref = refAt(grid, row, column);
    const value = ref === undefined ? undefined : sheet.cells[keyOf(ref)]?.value;
    return value === undefined || value.kind === "reference" ? undefined : value;
  };

  if (target.column === source.column && target.columns === source.columns) {
    const forward = target.row >= source.row + source.rows;
    return Array.from({ length: source.columns }, (_, offset) => {
      const column = source.column + offset;
      return {
        pattern: Array.from({ length: source.rows }, (_, index) => cellOf(source.row + index, column)),
        targets: Array.from({ length: target.rows }, (_, index) => [target.row + index, column] as const),
        forward
      };
    });
  }
  if (target.row === source.row && target.rows === source.rows) {
    const forward = target.column >= source.column + source.columns;
    return Array.from({ length: source.rows }, (_, offset) => {
      const row = source.row + offset;
      return {
        pattern: Array.from({ length: source.columns }, (_, index) => cellOf(row, source.column + index)),
        targets: Array.from({ length: target.columns }, (_, index) => [row, target.column + index] as const),
        forward
      };
    });
  }
  return undefined;
};

export const filled = (sheet: LiveSheet, grid: Grid, source: Rect, target: Rect): Filled => {
  const lanes = lanesOf(sheet, grid, source, target);
  if (lanes === undefined) return { ops: [], refused: "Fill runs down, up, left or right, one direction at a time." };

  for (let row = source.row; row < source.row + source.rows; row += 1) {
    for (let column = source.column; column < source.column + source.columns; column += 1) {
      const ref = refAt(grid, row, column);
      const expression = ref === undefined ? undefined : sheet.cells[keyOf(ref)]?.expression;
      if (expression !== undefined) {
        return { ops: [], refused: `Not filled. Shifting the references in ${expression} needs the engine's parser.` };
      }
    }
  }

  const spills = spillSpans(sheet, grid);
  const merges = mergeSpans(sheet, grid);
  const ops: SpreadsheetOp[] = [];
  let skipped = 0;
  let word = "Filled";
  const preview: string[] = [];

  for (const lane of lanes) {
    const series = seriesOf(lane);
    word = series.word;
    lane.targets.forEach(([row, column], index) => {
      const ref = refAt(grid, row, column);
      if (ref === undefined) return;
      const spill = spanCovering(spills, row, column);
      const merge = spanCovering(merges, row, column);
      if ((spill !== undefined && !isAnchor(spill, row, column)) || (merge !== undefined && !isAnchor(merge, row, column))) {
        skipped += 1;
        return;
      }
      const value = series.values[index];
      if (preview.length < 3) preview.push(displayOf(value));
      ops.push(...written(sheet, ref, value));
    });
  }

  return {
    ops,
    skipped,
    summary: `${word} · ${preview.join(" · ")}${lanes[0].targets.length > 3 ? " · …" : ""}`
  };
};

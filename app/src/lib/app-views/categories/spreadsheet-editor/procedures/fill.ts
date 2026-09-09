import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  keyOf,
  refAt,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { expressed, written } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { shifted } from "$representation/data/behavior/spreadsheets/translation";
import {
  isAnchor,
  spanCovering,
  type Edit
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { mergeSpans } from "$app-views/categories/spreadsheet-editor/procedures/merge-spans";
import { spillSpans } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Filled = Edit & { readonly summary?: string };

type Lane = {
  readonly pattern: readonly (FormulaValue | undefined)[];
  readonly sources: readonly (readonly [number, number])[];
  readonly targets: readonly (readonly [number, number])[];
  readonly forward: boolean;
};

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
        sources: Array.from({ length: source.rows }, (_, index) => [source.row + index, column] as const),
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
        sources: Array.from({ length: source.columns }, (_, index) => [row, source.column + index] as const),
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
      const [sourceRow, sourceColumn] = lane.sources[index % lane.sources.length];
      const from = refAt(grid, sourceRow, sourceColumn);
      const held = from === undefined ? undefined : sheet.cells[keyOf(from)];

      if (held?.expression !== undefined) {
        const anchors = held.anchors ?? [];
        const formula = shifted(held.expression, anchors, grid, row - sourceRow, column - sourceColumn);
        if (preview.length < 3) preview.push("a formula");
        word = "Filled";
        ops.push(...expressed(sheet, ref, { formula, anchors }));
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

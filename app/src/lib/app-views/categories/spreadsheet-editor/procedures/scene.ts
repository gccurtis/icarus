import type { Mark } from "$representation/data/types/content/content-block";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type {
  SurfaceCell,
  SurfacePin,
  SurfaceRun,
  SurfaceScene,
  SurfaceTrack
} from "$authored-components/sheet-surface";
import {
  columnLabel,
  keyOf,
  refAt,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  alignOf,
  cellWeightOf,
  emphasisOf,
  familyOf,
  paintOf,
  sizeOf,
  valignOf
} from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { endOf, startOf } from "$app-views/categories/spreadsheet-editor/procedures/marks";
import { isAnchor, mergeSpans, spanCovering, spillSpans } from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT } from "$app-views/categories/spreadsheet-editor/procedures/structure";
import { displayOf, errorOf, kindOf, rawOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type { SurfacePin } from "$authored-components/sheet-surface";

const EMPTY: SurfaceCell = {
  text: "",
  raw: "",
  tone: "plain",
  align: "left",
  valign: "middle",
  spilled: false,
  weight: 400,
  italic: false,
  underline: false,
  strike: false,
  mono: false,
  covered: false,
  readonly: true
};

const COVERED: SurfaceCell = { ...EMPTY, covered: true };

export const runsOf = (text: string, marks: readonly Mark[]): SurfaceRun[] => {
  const clamp = (at: number) => Math.max(0, Math.min(at, text.length));
  const edges = new Set<number>([0, text.length]);
  for (const mark of marks) {
    edges.add(clamp(startOf(mark)));
    edges.add(clamp(endOf(mark)));
  }
  const bounds = [...edges].sort((a, b) => a - b);
  const runs: SurfaceRun[] = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const from = bounds[index];
    const to = bounds[index + 1];
    if (to <= from) continue;
    const covering = marks.filter((mark) => startOf(mark) <= from && endOf(mark) >= to);
    const styles = new Set(covering.flatMap((mark) => mark.style ?? []));
    const color = covering.find((mark) => mark.color !== undefined)?.color;
    runs.push({
      text: text.slice(from, to),
      bold: styles.has("bold"),
      italic: styles.has("italic"),
      underline: styles.has("underline") || covering.some((mark) => mark.link !== undefined),
      strike: styles.has("strikethrough"),
      code: styles.has("code"),
      color: color ?? (covering.some((mark) => mark.link !== undefined) ? "--token-color-interactive-text" : undefined)
    });
  }
  return runs;
};

export const sceneOf = (
  sheet: LiveSheet,
  grid: Grid,
  pins: ReadonlyMap<string, SurfacePin>
): SurfaceScene => {
  const merges = mergeSpans(sheet, grid);
  const spills = spillSpans(sheet, grid);
  const cache = new Map<string, SurfaceCell>();

  const columns: SurfaceTrack[] = grid.columns.map((column, index) => ({
    id: column.id,
    label: columnLabel(index),
    size: column.width ?? DEFAULT_COLUMN_WIDTH
  }));
  const rows: SurfaceTrack[] = grid.rows.map((row, index) => ({
    id: row.id,
    label: String(index + 1),
    size: row.height ?? DEFAULT_ROW_HEIGHT
  }));

  const cellAt = (row: number, column: number): SurfaceCell => {
    const cacheKey = `${row},${column}`;
    const seen = cache.get(cacheKey);
    if (seen !== undefined) return seen;

    const ref = refAt(grid, row, column);
    if (ref === undefined) return EMPTY;
    const key = keyOf(ref);
    const held = sheet.cells[key];

    const merge = spanCovering(merges, row, column);
    if (merge !== undefined && !isAnchor(merge, row, column)) {
      const covered =
        merge.rect.row === row && merge.rect.columns > 1
          ? { ...COVERED, span: merge.rect.columns, spanFrom: merge.rect.column }
          : COVERED;
      cache.set(cacheKey, covered);
      return covered;
    }
    const spill = spanCovering(spills, row, column);
    const child = spill !== undefined && !isAnchor(spill, row, column);

    const paint = paintOf(sheet.body, grid, ref, held);
    const kind = kindOf(held?.value);
    const error = errorOf(held?.value);
    const pending = held?.expression !== undefined && held.value.kind === "empty";
    const text = pending ? (held.expression ?? "") : displayOf(held?.value, paint.format.valueFormat);
    const tone = error !== undefined ? "error" : child ? "spill" : pending ? "pending" : held?.expression !== undefined ? "formula" : "plain";
    const marks = held?.marks;
    const emphasis = emphasisOf(paint);

    const cell: SurfaceCell = {
      text,
      raw: rawOf(held),
      tone,
      align: alignOf(paint, kind),
      valign: valignOf(paint),
      spilled: spill !== undefined,
      weight: cellWeightOf(paint),
      italic: emphasis.italic,
      underline: emphasis.underline,
      strike: emphasis.strikethrough,
      mono: false,
      size: sizeOf(paint),
      font: familyOf(paint),
      color: paint.format.color ?? paint.style.color,
      background: paint.format.background ?? paint.style.background,
      span: merge !== undefined && merge.rect.columns > 1 ? merge.rect.columns : undefined,
      covered: false,
      readonly: child,
      runs: marks !== undefined && marks.length > 0 && tone === "plain" ? runsOf(text, marks) : undefined,
      pin: pins.get(key)
    };
    cache.set(cacheKey, cell);
    return cell;
  };

  return { columns, rows, frozenColumns: sheet.body.frozenColumns ?? 0, cellAt };
};

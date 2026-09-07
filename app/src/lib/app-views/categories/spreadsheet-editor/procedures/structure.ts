import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { CarriedColumn, CarriedRow } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { DEFAULT_FONT_SIZE, paintOf, sizeOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";
import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export const DEFAULT_ROW_HEIGHT = 26;
export const DEFAULT_COLUMN_WIDTH = 112;
export const APPEND_ROWS = 20;
export const APPEND_COLUMNS = 50;

const GLYPH = 7.2;
const PADDING = 18;

export type Inserted = { readonly ops: readonly SpreadsheetOp[]; readonly ids: readonly string[] };

export const insertedRows = (after: string | null, count: number): Inserted => {
  const ids = Array.from({ length: Math.max(1, count) }, () => mint("row"));
  return {
    ids,
    ops: [
      {
        op: "insert",
        target: "gridRow",
        path: "rows",
        ids,
        after,
        values: ids.map((id) => ({ id, order: 0 }))
      }
    ]
  };
};

export const insertedColumns = (after: string | null, count: number): Inserted => {
  const ids = Array.from({ length: Math.max(1, count) }, () => mint("column"));
  return {
    ids,
    ops: [
      {
        op: "insert",
        target: "gridColumn",
        path: "columns",
        ids,
        after,
        values: ids.map((id) => ({ id, order: 0 }))
      }
    ]
  };
};

const predecessorOf = (
  ordered: readonly { id: string }[],
  index: number,
  going: ReadonlySet<string>
): string | null => {
  for (let at = index - 1; at >= 0; at -= 1) {
    const candidate = ordered[at].id;
    if (!going.has(candidate)) return candidate;
  }
  return null;
};

export const removedRows = (sheet: LiveSheet, grid: Grid, ids: readonly string[]): SpreadsheetOp[] => {
  const going = new Set(ids);
  return grid.rows.flatMap((row, index) => {
    if (!going.has(row.id)) return [];
    const carried: CarriedRow = {
      ...row,
      cells: Object.values(sheet.cells).filter((cell) => cell.rowId === row.id)
    };
    return [
      {
        op: "remove" as const,
        target: "gridRow" as const,
        path: "rows",
        ids: [row.id],
        after: predecessorOf(grid.rows, index, going),
        values: [carried]
      }
    ];
  });
};

export const removedColumns = (
  sheet: LiveSheet,
  grid: Grid,
  ids: readonly string[]
): SpreadsheetOp[] => {
  const going = new Set(ids);
  return grid.columns.flatMap((column, index) => {
    if (!going.has(column.id)) return [];
    const carried: CarriedColumn = {
      ...column,
      cells: Object.values(sheet.cells).filter((cell) => cell.columnId === column.id)
    };
    return [
      {
        op: "remove" as const,
        target: "gridColumn" as const,
        path: "columns",
        ids: [column.id],
        after: predecessorOf(grid.columns, index, going),
        values: [carried]
      }
    ];
  });
};

const moved = (
  ordered: readonly { id: string }[],
  from: number,
  to: number,
  target: "gridRow" | "gridColumn"
): SpreadsheetOp | undefined => {
  const held = ordered[from];
  if (held === undefined || from === to || to < 0 || to >= ordered.length) return undefined;
  const without = ordered.filter((_, index) => index !== from);
  return {
    op: "move",
    target,
    path: target === "gridRow" ? "rows" : "columns",
    id: held.id,
    after: to === 0 ? null : without[to - 1].id,
    wasAfter: from === 0 ? null : ordered[from - 1].id
  };
};

export const movedRow = (grid: Grid, from: number, to: number): SpreadsheetOp | undefined =>
  moved(grid.rows, from, to, "gridRow");

export const movedColumn = (grid: Grid, from: number, to: number): SpreadsheetOp | undefined =>
  moved(grid.columns, from, to, "gridColumn");

export const resizedColumn = (grid: Grid, id: string, width: number): SpreadsheetOp | undefined => {
  const held = grid.columns.find((column) => column.id === id);
  if (held === undefined) return undefined;
  const next = Math.max(24, Math.round(width));
  if ((held.width ?? DEFAULT_COLUMN_WIDTH) === next) return undefined;
  return { op: "set", target: "sheet", path: `columns/${id}/width`, value: next, was: held.width ?? null };
};

export const resizedRow = (grid: Grid, id: string, height: number): SpreadsheetOp | undefined => {
  const held = grid.rows.find((row) => row.id === id);
  if (held === undefined) return undefined;
  const next = Math.max(16, Math.round(height));
  if ((held.height ?? DEFAULT_ROW_HEIGHT) === next) return undefined;
  return { op: "set", target: "sheet", path: `rows/${id}/height`, value: next, was: held.height ?? null };
};

export const frozenColumnsSet = (body: SpreadsheetBody, count: number): SpreadsheetOp | undefined => {
  const next = Math.max(0, Math.min(Math.round(count), body.columns.length));
  if ((body.frozenColumns ?? 0) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: "frozenColumns",
    value: next === 0 ? null : next,
    was: body.frozenColumns ?? null
  };
};

export const frozenRowsSet = (body: SpreadsheetBody, count: number): SpreadsheetOp | undefined => {
  const next = Math.max(0, Math.min(Math.round(count), body.rows.length));
  if ((body.frozenRows ?? 0) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: "frozenRows",
    value: next === 0 ? null : next,
    was: body.frozenRows ?? null
  };
};

export const heightOf = (grid: Grid, id: string): number =>
  grid.rows.find((row) => row.id === id)?.height ?? DEFAULT_ROW_HEIGHT;

export const widthOf = (grid: Grid, id: string): number =>
  grid.columns.find((column) => column.id === id)?.width ?? DEFAULT_COLUMN_WIDTH;

const copied = (cell: SheetCell): Omit<SheetCell, "rowId" | "columnId"> => ({
  value: cell.value,
  ...(cell.expression === undefined ? {} : { expression: cell.expression }),
  ...(cell.anchors === undefined ? {} : { anchors: [...cell.anchors] }),
  ...(cell.format === undefined ? {} : { format: cell.format }),
  ...(cell.marks === undefined ? {} : { marks: cell.marks })
});

export const duplicatedRows = (sheet: LiveSheet, grid: Grid, ids: readonly string[]): SpreadsheetOp[] => {
  const sources = grid.rows.filter((row) => ids.includes(row.id));
  if (sources.length === 0) return [];
  const made = sources.map((row) => ({ source: row, id: mint("row") }));
  const ops: SpreadsheetOp[] = [
    {
      op: "insert",
      target: "gridRow",
      path: "rows",
      ids: made.map((held) => held.id),
      after: sources[sources.length - 1].id,
      values: made.map(({ source, id }) => ({ id, order: 0, ...(source.height === undefined ? {} : { height: source.height }) }))
    }
  ];
  for (const { source, id } of made) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell.rowId !== source.id) continue;
      ops.push({ op: "set", target: "cell", path: `${id}/${cell.columnId}`, value: copied(cell), was: null });
    }
  }
  return ops;
};

export const duplicatedColumns = (sheet: LiveSheet, grid: Grid, ids: readonly string[]): SpreadsheetOp[] => {
  const sources = grid.columns.filter((column) => ids.includes(column.id));
  if (sources.length === 0) return [];
  const made = sources.map((column) => ({ source: column, id: mint("column") }));
  const ops: SpreadsheetOp[] = [
    {
      op: "insert",
      target: "gridColumn",
      path: "columns",
      ids: made.map((held) => held.id),
      after: sources[sources.length - 1].id,
      values: made.map(({ source, id }) => ({ id, order: 0, ...(source.width === undefined ? {} : { width: source.width }) }))
    }
  ];
  for (const { source, id } of made) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell.columnId !== source.id) continue;
      ops.push({ op: "set", target: "cell", path: `${cell.rowId}/${id}`, value: copied(cell), was: null });
    }
  }
  return ops;
};

export const fittedColumn = (sheet: LiveSheet, grid: Grid, id: string): SpreadsheetOp | undefined => {
  let longest = 0;
  for (const cell of Object.values(sheet.cells)) {
    if (cell.columnId !== id) continue;
    const ref = { rowId: cell.rowId, columnId: cell.columnId };
    const paint = paintOf(sheet.body, grid, ref, cell);
    const text = displayOf(cell.value, paint.format.valueFormat) || (cell.expression ?? "");
    const glyph = (GLYPH * (sizeOf(paint) ?? DEFAULT_FONT_SIZE)) / DEFAULT_FONT_SIZE;
    longest = Math.max(longest, text.length * glyph);
  }
  return resizedColumn(grid, id, Math.min(480, Math.max(48, Math.round(longest + PADDING))));
};

export const fittedRow = (sheet: LiveSheet, grid: Grid, id: string): SpreadsheetOp | undefined => {
  let tallest = DEFAULT_FONT_SIZE;
  for (const cell of Object.values(sheet.cells)) {
    if (cell.rowId !== id) continue;
    const paint = paintOf(sheet.body, grid, { rowId: cell.rowId, columnId: cell.columnId }, cell);
    tallest = Math.max(tallest, sizeOf(paint) ?? DEFAULT_FONT_SIZE);
  }
  return resizedRow(grid, id, Math.max(DEFAULT_ROW_HEIGHT, Math.round(tallest * 1.4 + 8)));
};

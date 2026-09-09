import type { CarriedColumn } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";
import {
  copied,
  moved,
  predecessorOf
} from "$app-views/categories/spreadsheet-editor/procedures/track-structure";

export type InsertedColumns = {
  readonly ops: readonly SpreadsheetOp[];
  readonly ids: readonly string[];
};

export const insertedColumns = (after: string | null, count: number): InsertedColumns => {
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

export const movedColumn = (grid: Grid, from: number, to: number): SpreadsheetOp | undefined =>
  moved(grid.columns, from, to, "gridColumn");

export const duplicatedColumns = (
  sheet: LiveSheet,
  grid: Grid,
  ids: readonly string[]
): SpreadsheetOp[] => {
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
      values: made.map(({ source, id }) => ({
        id,
        order: 0,
        ...(source.width === undefined ? {} : { width: source.width })
      }))
    }
  ];
  for (const { source, id } of made) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell.columnId !== source.id) continue;
      ops.push({
        op: "set",
        target: "cell",
        path: `${cell.rowId}/${id}`,
        value: copied(cell),
        was: null
      });
    }
  }
  return ops;
};

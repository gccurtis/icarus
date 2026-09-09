import type { CarriedRow } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";
import {
  copied,
  moved,
  predecessorOf
} from "$app-views/categories/spreadsheet-editor/procedures/track-structure";

export type InsertedRows = { readonly ops: readonly SpreadsheetOp[]; readonly ids: readonly string[] };

export const insertedRows = (after: string | null, count: number): InsertedRows => {
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

export const removedRows = (
  sheet: LiveSheet,
  grid: Grid,
  ids: readonly string[]
): SpreadsheetOp[] => {
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

export const movedRow = (grid: Grid, from: number, to: number): SpreadsheetOp | undefined =>
  moved(grid.rows, from, to, "gridRow");

export const duplicatedRows = (
  sheet: LiveSheet,
  grid: Grid,
  ids: readonly string[]
): SpreadsheetOp[] => {
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
      values: made.map(({ source, id }) => ({
        id,
        order: 0,
        ...(source.height === undefined ? {} : { height: source.height })
      }))
    }
  ];
  for (const { source, id } of made) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell.rowId !== source.id) continue;
      ops.push({
        op: "set",
        target: "cell",
        path: `${id}/${cell.columnId}`,
        value: copied(cell),
        was: null
      });
    }
  }
  return ops;
};

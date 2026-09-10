import type { TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import { cellKey } from "$representation/data/behavior/spreadsheets/apply-ops";
import { isStoredSheetCell } from "$representation/data/behavior/spreadsheets/stored-cell";

import type { StoreReads } from "$capabilities/spreadsheet/api/shared/ports";

export type CellRow = TableRow<"sheetCells">;

export const cellRowsOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">
): readonly CellRow[] => {
  const found = store.read("sheetCells");
  if (found?.table !== "sheetCells" || found.kind !== "table") return [];

  if (!found.rows.every(isStoredSheetCell)) {
    throw new Error("the sheetCells table contains a non-current row");
  }
  return found.rows.filter((row) => row.projectId === projectId && row.resourceId === resourceId);
};

export const cellOf = (row: CellRow): SheetCell => ({
  rowId: row.rowId,
  columnId: row.columnId,
  value: row.value,
  ...(row.expression === undefined ? {} : { expression: row.expression }),
  ...(row.anchors === undefined ? {} : { anchors: row.anchors }),
  ...(row.formulaId === undefined ? {} : { formulaId: row.formulaId }),
  ...(row.failure === undefined ? {} : { failure: row.failure }),
  ...(row.marks === undefined ? {} : { marks: row.marks }),
  ...(row.format === undefined ? {} : { format: row.format }),
  ...(row.mergedTo === undefined ? {} : { mergedTo: row.mergedTo }),
  ...(row.spillTo === undefined ? {} : { spillTo: row.spillTo })
});

export const cellsOf = (rows: readonly CellRow[]): Record<string, SheetCell> =>
  Object.fromEntries(rows.map((row) => [cellKey(row.rowId, row.columnId), cellOf(row)]));

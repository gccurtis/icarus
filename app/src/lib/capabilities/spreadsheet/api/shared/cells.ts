import type { TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import { cellKey } from "$representation/data/behavior/spreadsheets/apply-ops";

import type { StoreReads } from "$capabilities/spreadsheet/api/shared/ports";

export type CellRow = TableRow<"sheetCells">;

export const cellRowsOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">
): readonly CellRow[] => {
  const found = store.read("sheetCells");
  if (found?.table !== "sheetCells" || found.kind !== "table") return [];

  return found.rows.filter((row) => row.projectId === projectId && row.resourceId === resourceId);
};

export const cellOf = (row: CellRow): SheetCell => {
  const { _id, _creationTime, projectId, resourceId, rowOrder, ...cell } = row;
  void _id;
  void _creationTime;
  void projectId;
  void resourceId;
  void rowOrder;
  return cell;
};

export const cellsOf = (rows: readonly CellRow[]): Record<string, SheetCell> =>
  Object.fromEntries(rows.map((row) => [cellKey(row.rowId, row.columnId), cellOf(row)]));

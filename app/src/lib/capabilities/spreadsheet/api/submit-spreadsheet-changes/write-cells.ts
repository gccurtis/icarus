import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { cellKey } from "$representation/data/behavior/spreadsheets/apply-ops";

import type { CellRow } from "$capabilities/spreadsheet/api/shared/cells";

const canon = (cell: SheetCell, rowOrder: number): string =>
  JSON.stringify({
    rowOrder,
    value: cell.value,
    expression: cell.expression ?? null,
    anchors: cell.anchors ?? null,
    failure: cell.failure ?? null,
    formulaId: cell.formulaId ?? null,
    marks: cell.marks ?? null,
    format: cell.format ?? null,
    mergedTo: cell.mergedTo ?? null,
    spillTo: cell.spillTo ?? null
  });

export const writeCells = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  before: readonly CellRow[],
  after: LiveSheet
): void => {
  const orderOf = new Map(after.body.rows.map((row) => [row.id, row.order]));
  const held = new Map(before.map((row) => [cellKey(row.rowId, row.columnId), row]));

  for (const [key, cell] of Object.entries(after.cells)) {
    const rowOrder = orderOf.get(cell.rowId) ?? 0;
    const fields = { projectId, resourceId, rowOrder, ...cell };
    const existing = held.get(key);

    if (existing === undefined) {
      store.create("sheetCells", fields);
      continue;
    }
    if (canon(existing, existing.rowOrder) !== canon(cell, rowOrder)) {
      store.update(`sheetCells.${existing._id}`, fields);
    }
  }

  for (const [key, row] of held) {
    if (key in after.cells) continue;
    store.remove(`sheetCells.${row._id}`);
  }
};

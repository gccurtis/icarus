import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  cellKey,
  hasColumn,
  hasRow,
  insertAfter,
  refuse,
  reordered,
  withBody,
  withoutIds,
  type CarriedColumn,
  type CarriedRow,
  type ListOp,
  type MoveOp,
  type Ordered
} from "$representation/data/behavior/spreadsheets/editing";

export const listRows = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "rows") refuse(op, "rows are inserted and removed at rows");
  if (op.op === "insert") {
    const carried = op.values as CarriedRow[];
    if (carried.length !== op.ids.length || carried.some((row, index) => row.id !== op.ids[index])) {
      refuse(op, "ids and values disagree");
    }
    if (carried.some((row) => hasRow(sheet.body, row.id))) {
      refuse(op, "a row with that id is already there");
    }
    const bare = carried.map(({ cells: _cells, ...row }) => row);
    const rows = reordered(insertAfter(sheet.body.rows, op.after, bare, op), new Set(op.ids));
    const cells = { ...sheet.cells };
    for (const row of carried) {
      for (const cell of row.cells ?? []) {
        cells[cellKey(row.id, cell.columnId)] = { ...cell, rowId: row.id };
      }
    }
    return { body: { ...sheet.body, rows }, cells };
  }
  const rows = withoutIds(sheet.body.rows, op.ids, op);
  const going = new Set(op.ids);
  const cells = Object.fromEntries(
    Object.entries(sheet.cells).filter(([, cell]) => !going.has(cell.rowId))
  );
  return { body: { ...sheet.body, rows }, cells };
};

export const listColumns = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "columns") refuse(op, "columns are inserted and removed at columns");
  if (op.op === "insert") {
    const carried = op.values as CarriedColumn[];
    if (
      carried.length !== op.ids.length ||
      carried.some((column, index) => column.id !== op.ids[index])
    ) {
      refuse(op, "ids and values disagree");
    }
    if (carried.some((column) => hasColumn(sheet.body, column.id))) {
      refuse(op, "a column with that id is already there");
    }
    const bare = carried.map(({ cells: _cells, ...column }) => column);
    const columns = reordered(insertAfter(sheet.body.columns, op.after, bare, op), new Set(op.ids));
    const cells = { ...sheet.cells };
    for (const column of carried) {
      for (const cell of column.cells ?? []) {
        cells[cellKey(cell.rowId, column.id)] = { ...cell, columnId: column.id };
      }
    }
    return { body: { ...sheet.body, columns }, cells };
  }
  const columns = withoutIds(sheet.body.columns, op.ids, op);
  const going = new Set(op.ids);
  const cells = Object.fromEntries(
    Object.entries(sheet.cells).filter(([, cell]) => !going.has(cell.columnId))
  );
  return { body: { ...sheet.body, columns }, cells };
};

const moved = <T extends Ordered>(items: readonly T[], op: MoveOp): T[] => {
  const held = items.find((item) => item.id === op.id);
  if (held === undefined) return refuse(op, `no ${op.id} to move`);
  const without = items.filter((item) => item.id !== op.id);
  const at = op.after === null ? 0 : without.findIndex((item) => item.id === op.after) + 1;
  if (op.after !== null && at === 0) refuse(op, `nothing with id ${op.after} to move after`);
  const placed: T[] = [...without.slice(0, at), held, ...without.slice(at)];
  return reordered(placed, new Set([op.id]));
};

export const move = (sheet: LiveSheet, op: MoveOp): LiveSheet => {
  if (op.target === "gridRow") {
    if (op.path !== "rows") refuse(op, "rows move at rows");
    return withBody(sheet, { ...sheet.body, rows: moved(sheet.body.rows, op) });
  }
  if (op.path !== "columns") refuse(op, "columns move at columns");
  return withBody(sheet, { ...sheet.body, columns: moved(sheet.body.columns, op) });
};

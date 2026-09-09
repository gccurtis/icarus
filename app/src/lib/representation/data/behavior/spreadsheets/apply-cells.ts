import type { Mark } from "$representation/data/types/content/content-block";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  cellKey,
  hasColumn,
  hasRow,
  insertAfter,
  isValue,
  refuse,
  setDeep,
  withCell,
  withField,
  withoutIds,
  type ListOp,
  type SetOp
} from "$representation/data/behavior/spreadsheets/editing";

const cellAt = (sheet: LiveSheet, op: SpreadsheetOp) => {
  const [rowId, columnId, ...rest] = op.path.split("/");
  if (!rowId || !columnId) refuse(op, "a cell path is <rowId>/<columnId>[/<field>…]");
  if (!hasRow(sheet.body, rowId)) refuse(op, `no row ${rowId}`);
  if (!hasColumn(sheet.body, columnId)) refuse(op, `no column ${columnId}`);
  return { rowId, columnId, key: cellKey(rowId, columnId), rest };
};

export const setCell = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const { rowId, columnId, key, rest } = cellAt(sheet, op);
  const held = sheet.cells[key];

  if (rest.length === 0) {
    if (op.value === null) {
      const { [key]: gone, ...kept } = sheet.cells;
      void gone;
      return { ...sheet, cells: kept };
    }
    if (typeof op.value !== "object") refuse(op, "a whole cell is an object");
    const fields = op.value as Partial<SheetCell>;
    if (!isValue(fields.value)) refuse(op, "a cell holds a value");
    return withCell(sheet, key, { ...fields, rowId, columnId } as SheetCell);
  }

  const [field] = rest;
  if (field === "rowId" || field === "columnId") {
    refuse(op, "a cell's address is where it sits, not a field of it");
  }
  if (field === "marks") refuse(op, "marks are inserted and removed by id");
  if (field === "value" && !isValue(op.value)) refuse(op, "a value has a kind");

  const base: SheetCell = held ?? { rowId, columnId, value: { kind: "empty" } };
  return withCell(sheet, key, setDeep(base, rest, op.value) as SheetCell);
};

const marksAt = (sheet: LiveSheet, op: SpreadsheetOp) => {
  const [rowId, columnId, word, ...rest] = op.path.split("/");
  if (!rowId || !columnId || word !== "marks") {
    refuse(op, "a mark path is <rowId>/<columnId>/marks[/<markId>/<field>]");
  }
  const key = cellKey(rowId, columnId);
  const held = sheet.cells[key];
  if (held === undefined) refuse(op, `no cell at ${key}`);
  return { key, held, marks: held.marks ?? [], rest };
};

export const setMark = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const { key, held, marks, rest } = marksAt(sheet, op);
  const [markId, ...fields] = rest;
  if (!markId || fields.length === 0) refuse(op, "a mark is set one field at a time");
  const at = marks.findIndex((mark) => mark.id === markId);
  if (at === -1) refuse(op, `no mark ${markId}`);
  const next = marks.map((mark, index) =>
    index === at ? (setDeep(mark, fields, op.value) as Mark) : mark
  );
  return withCell(sheet, key, { ...held, marks: next });
};

export const listMarks = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  const { key, held, marks, rest } = marksAt(sheet, op);
  if (rest.length > 0) refuse(op, "marks are inserted and removed at <rowId>/<columnId>/marks");
  const next =
    op.op === "insert"
      ? insertAfter(marks, op.after, op.values as Mark[], op)
      : withoutIds(marks, op.ids, op);
  return withCell(
    sheet,
    key,
    next.length === 0 ? withField(held, "marks", null) : { ...held, marks: next }
  );
};

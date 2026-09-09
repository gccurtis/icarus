import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { listMarks, setCell, setMark } from "$representation/data/behavior/spreadsheets/apply-cells";
import {
  listRules,
  listStyles,
  setRule,
  setSheet
} from "$representation/data/behavior/spreadsheets/apply-formatting";
import { listColumns, listRows, move } from "$representation/data/behavior/spreadsheets/apply-tracks";
import { refuse } from "$representation/data/behavior/spreadsheets/editing";

export { cellKey, splitCellKey } from "$representation/data/behavior/spreadsheets/editing";
export type {
  CarriedColumn,
  CarriedRow
} from "$representation/data/behavior/spreadsheets/editing";

const applyOne = (sheet: LiveSheet, op: SpreadsheetOp): LiveSheet => {
  switch (op.op) {
    case "set":
      switch (op.target) {
        case "cell":
          return setCell(sheet, op);
        case "mark":
          return setMark(sheet, op);
        case "formatRule":
          return setRule(sheet, op);
        case "sheet":
          return setSheet(sheet, op);
      }
      return refuse(op, "not a target a set can name");
    case "insert":
    case "remove":
      switch (op.target) {
        case "gridRow":
          return listRows(sheet, op);
        case "gridColumn":
          return listColumns(sheet, op);
        case "formatRule":
          return listRules(sheet, op);
        case "mark":
          return listMarks(sheet, op);
        case "sheet":
          return listStyles(sheet, op);
      }
      return refuse(op, "not a target a list op can name");
    case "move":
      return move(sheet, op);
  }
};

export const applyOps = (sheet: LiveSheet, ops: readonly SpreadsheetOp[]): LiveSheet =>
  ops.reduce(applyOne, sheet);

export const invert = (op: SpreadsheetOp): SpreadsheetOp => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };
    case "insert":
      return { ...op, op: "remove" };
    case "remove":
      return { ...op, op: "insert" };
    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };
  }
};

export const invertAll = (ops: readonly SpreadsheetOp[]): SpreadsheetOp[] =>
  [...ops].reverse().map(invert);

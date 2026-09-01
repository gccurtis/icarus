import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

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

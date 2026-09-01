import type { DocumentOp } from "$representation/data/types/documents/op";

export const invert = (op: DocumentOp): DocumentOp => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };

    case "insert":
      return { ...op, op: "remove" };

    case "remove":
      return { ...op, op: "insert" };

    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };

    case "text":
      return { ...op, insert: op.remove, remove: op.insert };
  }
};

export const invertAll = (ops: readonly DocumentOp[]): DocumentOp[] =>
  [...ops].reverse().map(invert);

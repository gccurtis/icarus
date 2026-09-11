import type { PresentationOp } from "$representation/data/types/presentations/op";

export const invert = (op: PresentationOp): PresentationOp => {
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

export const invertAll = (ops: readonly PresentationOp[]): PresentationOp[] =>
  [...ops].reverse().map(invert);

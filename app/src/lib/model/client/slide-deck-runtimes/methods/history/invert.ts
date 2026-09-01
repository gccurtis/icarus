import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";

export const invert = (op: SlideDeckOp): SlideDeckOp => {
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

export const invertAll = (ops: readonly SlideDeckOp[]): SlideDeckOp[] =>
  [...ops].reverse().map(invert);

import type { ViewOp } from "$representation/data/types/views/op";

export const invert = (op: ViewOp): ViewOp => {
  switch (op.op) {
    case "open":
      return { ...op, op: "close" };

    case "close":
      return { ...op, op: "open" };

    case "activate":
      return { ...op, was: op.now, now: op.was };

    case "land":
      return { ...op, was: op.now, now: op.was };

    case "context":
      return { ...op, was: op.now, now: op.was };

    case "inspect":
      return {
        ...op,
        was: op.now,
        now: op.was,
        wasSelection: op.selection,
        selection: op.wasSelection
      };

    case "resize":
      return { ...op, was: op.now, now: op.was };
  }
};

export const invertAll = (ops: readonly ViewOp[]): ViewOp[] => [...ops].reverse().map(invert);

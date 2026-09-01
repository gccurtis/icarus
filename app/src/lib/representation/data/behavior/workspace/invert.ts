import type { WorkspaceOp } from "$representation/data/types/workspace/op";

export const invert = (op: WorkspaceOp): WorkspaceOp => {
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

export const invertAll = (ops: readonly WorkspaceOp[]): WorkspaceOp[] =>
  [...ops].reverse().map(invert);

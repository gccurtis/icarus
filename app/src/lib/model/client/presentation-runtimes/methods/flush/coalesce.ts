import type { PresentationOp } from "$representation/data/types/presentations/op";

const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

export const coalesce = (ops: readonly PresentationOp[]): PresentationOp[] => {
  const folded: PresentationOp[] = [];

  for (const op of ops) {
    if (op.op !== "set") {
      folded.push(op);
      continue;
    }

    const previous = lastSetOn(folded, op.path);
    if (previous === -1 || crossesRelatedGround(folded, previous, op.path)) {
      folded.push(op);
      continue;
    }

    const earlier = folded[previous] as Extract<PresentationOp, { op: "set" }>;
    folded[previous] = { ...op, was: earlier.was };
  }

  return folded;
};

const lastSetOn = (ops: readonly PresentationOp[], path: string): number => {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    const op = ops[index];
    if (op.op === "set" && op.path === path) return index;
  }
  return -1;
};

const crossesRelatedGround = (ops: readonly PresentationOp[], from: number, path: string): boolean =>
  ops.slice(from + 1).some((between) => related(between.path, path));

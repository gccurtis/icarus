import type { DocumentOp } from "$representation/data/types/documents/op";

type Splice = Extract<DocumentOp, { op: "text" }>;

const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

const clamp = (value: number, limit: number): number => Math.min(Math.max(value, 0), limit);

/**
 * One splice standing for `earlier` then `later`, or nothing when the two do not
 * touch. Both are stated against the string the one before it produced, and both
 * are this author's in order, so composing them is arithmetic over one string.
 */
export const compose = (earlier: Splice, later: Splice): Splice | undefined => {
  const inserted = earlier.insert;
  const start = later.at;
  const end = later.at + later.remove.length;

  if (start > earlier.at + inserted.length || end < earlier.at) return undefined;

  const before = Math.max(0, earlier.at - start);
  const after = Math.max(0, end - (earlier.at + inserted.length));
  const kept = {
    head: clamp(start - earlier.at, inserted.length),
    tail: clamp(end - earlier.at, inserted.length)
  };

  return {
    op: "text",
    target: "atom",
    path: earlier.path,
    at: Math.min(earlier.at, start),
    remove:
      later.remove.slice(0, before) +
      earlier.remove +
      (after === 0 ? "" : later.remove.slice(later.remove.length - after)),
    insert: inserted.slice(0, kept.head) + later.insert + inserted.slice(kept.tail)
  };
};

const lastOn = (ops: readonly DocumentOp[], op: DocumentOp): number => {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    const candidate = ops[index];
    if (candidate.op === op.op && candidate.path === op.path) return index;
  }
  return -1;
};

const crossesRelatedGround = (
  ops: readonly DocumentOp[],
  from: number,
  path: string
): boolean => ops.slice(from + 1).some((between) => related(between.path, path));

const foldable = (folded: readonly DocumentOp[], op: DocumentOp): number => {
  const previous = lastOn(folded, op);
  return previous === -1 || crossesRelatedGround(folded, previous, op.path) ? -1 : previous;
};

export const coalesce = (ops: readonly DocumentOp[]): DocumentOp[] => {
  const folded: DocumentOp[] = [];

  for (const op of ops) {
    const previous = op.op === "set" || op.op === "text" ? foldable(folded, op) : -1;
    if (previous === -1) {
      folded.push(op);
      continue;
    }

    const earlier = folded[previous];

    if (op.op === "set") {
      folded[previous] = { ...op, was: (earlier as Extract<DocumentOp, { op: "set" }>).was };
      continue;
    }

    const composed = compose(earlier as Splice, op as Splice);
    if (composed === undefined) {
      folded.push(op);
      continue;
    }

    if (composed.insert.length === 0 && composed.remove.length === 0) {
      folded.splice(previous, 1);
      continue;
    }

    folded[previous] = composed;
  }

  return folded;
};

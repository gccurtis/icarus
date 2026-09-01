import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";

/**
 * Whether two paths could name overlapping ground.
 *
 * String comparison, never resolution. Equal paths overlap, and so does a path
 * that continues another — `slides/#s1` and `slides/#s1/elements/#e2`. Segment
 * boundaries matter: `slides/#s1` must not be read as containing
 * `slides/#s10`, which a bare `startsWith` would say it does.
 *
 * Conservative by design. Two paths this calls related may be unrelated in the
 * body; the cost of that is a fold that does not happen, which is always safe.
 */
const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * Fold the buffer before it goes.
 *
 * Dragging an element across a slide produces far more operations than changes:
 * one gesture is a stream of `set`s on one position that mean one move.
 * Submitting each is wasteful and fills history with steps nobody wants to see.
 *
 * **Only repeated `set`s on one path fold**, and only into the most recent
 * earlier `set` on that path. The result keeps the **last** `value` and the
 * **first** `was` — the net effect of the run, and what it started from. Keeping
 * the later `was` would make the folded op invert to an intermediate state that
 * never existed on the server.
 *
 * **A fold is refused when anything between the two touches related ground.**
 * Merging moves the later `set` earlier in the sequence, and that is only sound
 * if nothing in between could have changed what it applies to. `related` decides
 * that on the strings alone, because this object resolves no paths — the server
 * walks them.
 *
 * Nothing else folds. Two `text` ops on one atom look foldable and are not:
 * their offsets are stated against the string each one produced, so merging them
 * means recomputing offsets, which is the transform this design exists to avoid.
 *
 * **History is untouched.** This is the wire's view of the buffer; the undo
 * stack keeps one entry per gesture, and folding it would make one undo revert
 * whatever happened to share a path.
 */
export const coalesce = (ops: readonly SlideDeckOp[]): SlideDeckOp[] => {
  const folded: SlideDeckOp[] = [];

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

    const earlier = folded[previous] as Extract<SlideDeckOp, { op: "set" }>;
    folded[previous] = { ...op, was: earlier.was };
  }

  return folded;
};

const lastSetOn = (ops: readonly SlideDeckOp[], path: string): number => {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    const op = ops[index];
    if (op.op === "set" && op.path === path) return index;
  }
  return -1;
};

const crossesRelatedGround = (ops: readonly SlideDeckOp[], from: number, path: string): boolean =>
  ops.slice(from + 1).some((between) => related(between.path, path));

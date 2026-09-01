import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";

/**
 * Whether two paths could name overlapping ground.
 *
 * String comparison, never resolution. Equal paths overlap, and so does a path
 * that continues another — `rows/#g1` and `rows/#g1/cells/#A1`. Segment
 * boundaries matter: `rows/#g1` must not be read as containing `rows/#g10`,
 * which a bare `startsWith` would say it does.
 *
 * Conservative by design. Two paths this calls related may be unrelated in the
 * body; the cost of that is a fold that does not happen, which is always safe.
 */
const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * Fold the buffer before it goes.
 *
 * Editing one cell produces far more operations than changes: every keystroke in
 * the formula bar is a `set` on one path, and only the last one is what the cell
 * ends up holding. Submitting each is wasteful and fills history with steps
 * nobody wants to see.
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
 * A sheet has no `text` op, so the one case a document has to argue about is not
 * here: a cell is `set` whole, never spliced.
 *
 * **History is untouched.** This is the wire's view of the buffer; the undo
 * stack keeps one entry per gesture, and folding it would make one undo revert
 * whatever happened to share a path.
 */
export const coalesce = (ops: readonly SpreadsheetOp[]): SpreadsheetOp[] => {
  const folded: SpreadsheetOp[] = [];

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

    const earlier = folded[previous] as Extract<SpreadsheetOp, { op: "set" }>;
    folded[previous] = { ...op, was: earlier.was };
  }

  return folded;
};

const lastSetOn = (ops: readonly SpreadsheetOp[], path: string): number => {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    const op = ops[index];
    if (op.op === "set" && op.path === path) return index;
  }
  return -1;
};

const crossesRelatedGround = (ops: readonly SpreadsheetOp[], from: number, path: string): boolean =>
  ops.slice(from + 1).some((between) => related(between.path, path));

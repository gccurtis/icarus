import type { Op } from "$revisions/types/change";

type TextOp = Extract<Op, { op: "text" }>;

/**
 * The span a text op replaces, without the path.
 *
 * A mark shifts against the same arithmetic in the block's display coordinates,
 * where the op's own path names an atom and so says nothing about the offset.
 */
export type TextSpan = Pick<TextOp, "at" | "insert" | "remove">;

/** Refused: the offset is strictly inside what the op replaced, so it names text that is gone. */
export const CONFLICT = Symbol("conflict");

/**
 * Move one offset past an already-applied text op.
 *
 * **This is the only code in the system that fails open.** Every other check
 * rejects when in doubt and costs someone a resubmit; this one returns a number,
 * so a bug puts characters in the wrong order with no error raised.
 *
 * Offsets are UTF-16 code units, matching JavaScript string slicing, so a
 * surrogate pair is never split by an off-by-one — a position between the halves
 * of a removed pair is strictly inside and conflicts like any other.
 *
 * `p >= aEnd` before `p <= aStart` is what makes two inserts at one point
 * deterministic: both bounds equal `p`, the committed edit keeps the position,
 * and the later one lands after it whatever order they arrived in.
 *
 * `closing` reverses only that tie, for the far end of a range rather than a
 * position: text inserted exactly where a range ends landed outside it, so
 * moving the end would turn a clean merge into a conflict.
 */
export const shift = (p: number, a: TextSpan, closing = false): number | typeof CONFLICT => {
  const aStart = a.at;
  const aEnd = a.at + a.remove.length;
  const delta = a.insert.length - a.remove.length;

  if (closing && p <= aStart) return p;
  if (p >= aEnd) return p + delta;
  if (p <= aStart) return p;
  return CONFLICT;
};

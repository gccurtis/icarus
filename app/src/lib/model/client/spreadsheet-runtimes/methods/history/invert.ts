import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";

/**
 * The op that undoes one op.
 *
 * **A swap of payload fields, and nothing else.** No path is resolved, no body
 * is read, no round trip is made — which is the property the whole client-side
 * undo rests on, and the reason the vocabulary carries the payloads it does.
 *
 * | Op | Inverted by |
 * | --- | --- |
 * | `set` | a `set` exchanging `value` and `was` |
 * | `insert` | a `remove` with the same `ids`, `after` and `values` |
 * | `remove` | an `insert` with the same `ids`, `after` and `values` |
 * | `move` | a `move` exchanging `after` and `wasAfter` |
 *
 * **Four cases, where a document has five.** A cell holds a value and an
 * expression rather than atoms, so a sheet has no `text` op to invert — see the
 * [op vocabulary](../../../../../representation/data/types/revisions/spreadsheet-op.ts).
 *
 * `insert` and `remove` are exact mirrors over the same three targets, which is
 * what makes the two cases a rename. A cell is in neither: clearing one is a
 * `set`, and it inverts by exchanging `value` and `was` like any other.
 */
export const invert = (op: SpreadsheetOp): SpreadsheetOp => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };

    case "insert":
      return { ...op, op: "remove" };

    case "remove":
      return { ...op, op: "insert" };

    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };
  }
};

/**
 * One gesture, undone.
 *
 * Reversed as well as inverted: the ops in a gesture were applied in order, so
 * undoing it walks them backwards. Inverting each without reversing the sequence
 * undoes a two-op gesture in the wrong order and lands on a different sheet.
 */
export const invertAll = (ops: readonly SpreadsheetOp[]): SpreadsheetOp[] =>
  [...ops].reverse().map(invert);

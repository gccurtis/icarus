import type { Op } from "$revisions/types/op";

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
 * | `text` | a `text` at the same offset exchanging `insert` and `remove` |
 *
 * `insert` and `remove` are exact mirrors, which is why `insert` carries `ids`
 * it does not strictly need in order to apply — see the
 * [op vocabulary](../../../../../capabilities/revisions/types/op.ts).
 *
 * The `text` case is the one worth reading twice: after an edit at `at`, the
 * text sitting there is `insert`, so undoing it removes `insert` and puts
 * `remove` back. The offset does not move, because the inverse applies to the
 * string the edit produced.
 */
export const invert = (op: Op): Op => {
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

/**
 * One gesture, undone.
 *
 * Reversed as well as inverted: the ops in a gesture were applied in order, so
 * undoing it walks them backwards. Inverting each without reversing the sequence
 * undoes a two-op gesture in the wrong order and lands on a different document.
 */
export const invertAll = (ops: readonly Op[]): Op[] => [...ops].reverse().map(invert);

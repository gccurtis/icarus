import type { Op } from "$revisions/types/change";

/**
 * What a `remove` names its entries by.
 *
 * A merge is a bare range string with no record around it, so a value that is
 * its own identity is taken as such. A value with **no** identity of its own can
 * only be a keyed entry — a spreadsheet cell, addressed by where it sits — and
 * then the path's last segment is what names it, because nothing else could have.
 */
const idOf = (value: unknown, path: string): string => {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  const key = path.split("/").at(-1);
  if (key === undefined || key === "") {
    throw new Error("cannot invert an insert of a value that carries no id");
  }
  return key;
};

/**
 * The op that undoes this one.
 *
 * An undo is not a rewind: inverting each op of a set and reversing their order
 * produces an ordinary change set, submitted and conflict-checked like any
 * other. That is what the extra payloads buy — `was` reverses a `set`, `values`
 * and `after` reverse a `remove`, `wasAfter` reverses a `move` — and why
 * reconstructing them by replaying from the head is not needed.
 *
 * A `text` op's marks are not here, because a text op carries none: applying the
 * inverse shifts them back by the same rule that moved them.
 */
export const invert = (op: Op): Op => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };
    case "insert":
      return {
        op: "remove",
        target: op.target,
        path: op.path,
        ids: op.values.map((value) => idOf(value, op.path)),
        after: op.after,
        values: op.values
      };
    case "remove":
      return { op: "insert", target: op.target, path: op.path, after: op.after, values: op.values };
    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };
    case "text":
      return { ...op, insert: op.remove, remove: op.insert };
  }
};

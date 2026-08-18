import assert from "node:assert/strict";
import { test } from "vitest";
import type { Op } from "$revisions/types/op";
import { invert, invertAll } from "$model/client/resource-runtimes/methods/history/invert";

/**
 * Inversion is a swap of payload fields and nothing else — no path resolved, no
 * body read, no round trip. That property is what makes a client-side undo
 * possible at all, so these assertions are the ones that matter most in the
 * object.
 */

test("a set exchanges value and was", () => {
  const op: Op = { op: "set", target: "field", path: "page/margin", value: 3, was: 1 };

  assert.deepEqual(invert(op), { op: "set", target: "field", path: "page/margin", value: 1, was: 3 });
});

test("an insert inverts to a remove naming the same ids", () => {
  const op: Op = {
    op: "insert",
    target: "row",
    path: "rows",
    ids: ["r1", "r2"],
    after: "r0",
    values: [{ id: "r1" }, { id: "r2" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "remove" });
});

test("a remove inverts to an insert putting the same values back", () => {
  const op: Op = {
    op: "remove",
    target: "row",
    path: "rows",
    ids: ["r1"],
    after: "r0",
    values: [{ id: "r1" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "insert" });
});

test("a move exchanges after and wasAfter", () => {
  const op: Op = { op: "move", target: "slide", path: "slides", id: "s3", after: "s1", wasAfter: null };

  assert.deepEqual(invert(op), { ...op, after: null, wasAfter: "s1" });
});

test("a text op exchanges its two strings at the same offset", () => {
  // After an edit at `at`, the text sitting there is `insert` — so undoing it
  // removes `insert` and puts `remove` back. The offset does not move.
  const op: Op = { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 4, insert: "cat", remove: "dog" };

  assert.deepEqual(invert(op), { ...op, insert: "dog", remove: "cat" });
});

test("inverting twice returns the original", () => {
  const ops: Op[] = [
    { op: "set", target: "field", path: "p", value: 2, was: 1 },
    { op: "insert", target: "row", path: "rows", ids: ["r1"], after: null, values: [{ id: "r1" }] },
    { op: "remove", target: "row", path: "rows", ids: ["r2"], after: "r1", values: [{ id: "r2" }] },
    { op: "move", target: "slide", path: "slides", id: "s1", after: "s2", wasAfter: null },
    { op: "text", target: "atom", path: "a", at: 0, insert: "x", remove: "y" }
  ];

  for (const op of ops) assert.deepEqual(invert(invert(op)), op);
});

test("inverting never reads a value or resolves a path", () => {
  // A payload the client could not possibly interpret still inverts.
  const op: Op = {
    op: "set",
    target: "field",
    path: "whatever/#x/deeply/nested",
    value: Symbol.for("opaque"),
    was: { arbitrary: { nested: [1, 2, 3] } }
  };

  const inverted = invert(op) as Extract<Op, { op: "set" }>;

  assert.deepEqual(inverted.value, { arbitrary: { nested: [1, 2, 3] } });
  assert.equal(inverted.was, Symbol.for("opaque"));
  assert.equal(inverted.path, op.path);
});

test("a gesture is inverted in reverse order", () => {
  // The ops applied in order, so undoing walks them backwards. Inverting each in
  // place undoes a two-op gesture in the wrong order and lands somewhere else.
  const gesture: Op[] = [
    { op: "set", target: "field", path: "first", value: 2, was: 1 },
    { op: "set", target: "field", path: "second", value: 20, was: 10 }
  ];

  const undone = invertAll(gesture);

  assert.equal(undone[0].path, "second");
  assert.equal(undone[1].path, "first");
});

test("inverting a gesture leaves the original untouched", () => {
  const gesture: Op[] = [
    { op: "set", target: "field", path: "a", value: 2, was: 1 },
    { op: "set", target: "field", path: "b", value: 4, was: 3 }
  ];

  invertAll(gesture);

  assert.equal(gesture[0].path, "a");
});

import assert from "node:assert/strict";
import { test } from "vitest";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { invert, invertAll } from "$model/client/document-runtimes/methods/history/invert";

test("a set exchanges value and was", () => {
  const op: DocumentOp = { op: "set", target: "row", path: "rows/#r1", value: 3, was: 1 };

  assert.deepEqual(invert(op), { op: "set", target: "row", path: "rows/#r1", value: 1, was: 3 });
});

test("an insert inverts to a remove naming the same ids", () => {
  const op: DocumentOp = {
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
  const op: DocumentOp = {
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
  const op: DocumentOp = {
    op: "move",
    target: "row",
    path: "rows",
    id: "r3",
    after: "r1",
    wasAfter: null
  };

  assert.deepEqual(invert(op), { ...op, after: null, wasAfter: "r1" });
});

test("a text op exchanges its two strings at the same offset", () => {
  const op: DocumentOp = {
    op: "text",
    target: "atom",
    path: "rows/#r1/atoms/#a1",
    at: 4,
    insert: "cat",
    remove: "dog"
  };

  assert.deepEqual(invert(op), { ...op, insert: "dog", remove: "cat" });
});

test("inverting twice returns the original", () => {
  const ops: DocumentOp[] = [
    { op: "set", target: "block", path: "rows/#r1/blocks/#b1", value: 2, was: 1 },
    { op: "insert", target: "row", path: "rows", ids: ["r1"], after: null, values: [{ id: "r1" }] },
    { op: "remove", target: "row", path: "rows", ids: ["r2"], after: "r1", values: [{ id: "r2" }] },
    { op: "move", target: "block", path: "rows/#r1/blocks", id: "b1", after: "b2", wasAfter: null },
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 0, insert: "x", remove: "y" }
  ];

  for (const op of ops) assert.deepEqual(invert(invert(op)), op);
});

test("inverting never reads a value or resolves a path", () => {
  const op: DocumentOp = {
    op: "set",
    target: "mark",
    path: "rows/#r1/atoms/#a1/marks/#m1",
    value: Symbol.for("opaque"),
    was: { arbitrary: { nested: [1, 2, 3] } }
  };

  const inverted = invert(op) as Extract<DocumentOp, { op: "set" }>;

  assert.deepEqual(inverted.value, { arbitrary: { nested: [1, 2, 3] } });
  assert.equal(inverted.was, Symbol.for("opaque"));
  assert.equal(inverted.path, op.path);
});

test("a gesture is inverted in reverse order", () => {
  const gesture: DocumentOp[] = [
    { op: "set", target: "row", path: "rows/#first", value: 2, was: 1 },
    { op: "set", target: "row", path: "rows/#second", value: 20, was: 10 }
  ];

  const undone = invertAll(gesture);

  assert.equal(undone[0].path, "rows/#second");
  assert.equal(undone[1].path, "rows/#first");
});

test("inverting a gesture leaves the original untouched", () => {
  const gesture: DocumentOp[] = [
    { op: "set", target: "row", path: "rows/#a", value: 2, was: 1 },
    { op: "set", target: "row", path: "rows/#b", value: 4, was: 3 }
  ];

  invertAll(gesture);

  assert.equal(gesture[0].path, "rows/#a");
});

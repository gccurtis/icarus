import assert from "node:assert/strict";
import { test } from "vitest";
import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";
import { invert, invertAll } from "$model/client/slide-deck-runtimes/methods/history/invert";

test("a set exchanges value and was", () => {
  const op: SlideDeckOp = { op: "set", target: "slide", path: "slides/#s1", value: 3, was: 1 };

  assert.deepEqual(invert(op), { op: "set", target: "slide", path: "slides/#s1", value: 1, was: 3 });
});

test("an insert inverts to a remove naming the same ids", () => {
  const op: SlideDeckOp = {
    op: "insert",
    target: "slide",
    path: "slides",
    ids: ["s1", "s2"],
    after: "s0",
    values: [{ id: "s1" }, { id: "s2" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "remove" });
});

test("a remove inverts to an insert putting the same values back", () => {
  const op: SlideDeckOp = {
    op: "remove",
    target: "slide",
    path: "slides",
    ids: ["s1"],
    after: "s0",
    values: [{ id: "s1" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "insert" });
});

test("a move exchanges after and wasAfter", () => {
  const op: SlideDeckOp = {
    op: "move",
    target: "slide",
    path: "slides",
    id: "s3",
    after: "s1",
    wasAfter: null
  };

  assert.deepEqual(invert(op), { ...op, after: null, wasAfter: "s1" });
});

test("a text op exchanges its two strings at the same offset", () => {
  const op: SlideDeckOp = {
    op: "text",
    target: "atom",
    path: "slides/#s1/elements/#e1/atoms/#a1",
    at: 4,
    insert: "cat",
    remove: "dog"
  };

  assert.deepEqual(invert(op), { ...op, insert: "dog", remove: "cat" });
});

test("inverting twice returns the original", () => {
  const ops: SlideDeckOp[] = [
    { op: "set", target: "element", path: "slides/#s1/elements/#e1", value: 2, was: 1 },
    { op: "insert", target: "slide", path: "slides", ids: ["s1"], after: null, values: [{ id: "s1" }] },
    { op: "remove", target: "section", path: "sections", ids: ["c2"], after: "c1", values: [{ id: "c2" }] },
    { op: "move", target: "element", path: "slides/#s1/elements", id: "e1", after: "e2", wasAfter: null },
    { op: "text", target: "atom", path: "slides/#s1/atoms/#a1", at: 0, insert: "x", remove: "y" }
  ];

  for (const op of ops) assert.deepEqual(invert(invert(op)), op);
});

test("inverting never reads a value or resolves a path", () => {
  const op: SlideDeckOp = {
    op: "set",
    target: "mark",
    path: "slides/#s1/elements/#e1/atoms/#a1/marks/#m1",
    value: Symbol.for("opaque"),
    was: { arbitrary: { nested: [1, 2, 3] } }
  };

  const inverted = invert(op) as Extract<SlideDeckOp, { op: "set" }>;

  assert.deepEqual(inverted.value, { arbitrary: { nested: [1, 2, 3] } });
  assert.equal(inverted.was, Symbol.for("opaque"));
  assert.equal(inverted.path, op.path);
});

test("a gesture is inverted in reverse order", () => {
  const gesture: SlideDeckOp[] = [
    { op: "set", target: "slide", path: "slides/#first", value: 2, was: 1 },
    { op: "set", target: "slide", path: "slides/#second", value: 20, was: 10 }
  ];

  const undone = invertAll(gesture);

  assert.equal(undone[0].path, "slides/#second");
  assert.equal(undone[1].path, "slides/#first");
});

test("inverting a gesture leaves the original untouched", () => {
  const gesture: SlideDeckOp[] = [
    { op: "set", target: "slide", path: "slides/#a", value: 2, was: 1 },
    { op: "set", target: "slide", path: "slides/#b", value: 4, was: 3 }
  ];

  invertAll(gesture);

  assert.equal(gesture[0].path, "slides/#a");
});

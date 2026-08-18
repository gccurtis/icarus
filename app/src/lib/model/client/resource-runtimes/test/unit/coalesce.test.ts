import assert from "node:assert/strict";
import { test } from "vitest";
import type { Op } from "$revisions/types/op";
import { coalesce } from "$model/client/resource-runtimes/methods/flush/coalesce";

const set = (path: string, value: unknown, was: unknown): Op => ({
  op: "set",
  target: "field",
  path,
  value,
  was
});

const insert = (path: string, id: string): Op => ({
  op: "insert",
  target: "row",
  path,
  ids: [id],
  after: null,
  values: [{ id }]
});

test("folds a run of sets on one path", () => {
  const folded = coalesce([set("page/margin", 2, 1), set("page/margin", 3, 2), set("page/margin", 4, 3)]);

  assert.equal(folded.length, 1);
  assert.deepEqual(folded[0], set("page/margin", 4, 1));
});

test("keeps the last value and the FIRST was", () => {
  // The asymmetry is the rule. `value` is where the run ended, `was` is where it
  // started — keeping the later `was` would produce an op that inverts to an
  // intermediate state the server never held.
  const folded = coalesce([set("page/margin", 2, 1), set("page/margin", 9, 2)]);

  assert.equal((folded[0] as Extract<Op, { op: "set" }>).value, 9);
  assert.equal((folded[0] as Extract<Op, { op: "set" }>).was, 1);
});

test("does not fold sets on different paths", () => {
  const ops = [set("page/margin", 2, 1), set("page/size", "a4", "letter")];

  assert.deepEqual(coalesce(ops), ops);
});

test("folds across an unrelated op between them", () => {
  const ops = [set("page/margin", 2, 1), set("page/size", "a4", "letter"), set("page/margin", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("page/margin", 3, 1));
});

test("refuses to fold across an op on the same path", () => {
  // Merging moves the later set earlier, which is only sound if nothing in
  // between could have changed what it applies to.
  const ops = [set("rows/#r1", 2, 1), insert("rows/#r1", "b2"), set("rows/#r1", 3, 2)];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground beneath it", () => {
  const ops = [set("rows/#r1", 2, 1), insert("rows/#r1/blocks", "b2"), set("rows/#r1", 3, 2)];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground above it", () => {
  const ops = [
    set("rows/#r1/blocks/#b2", 2, 1),
    insert("rows/#r1", "b3"),
    set("rows/#r1/blocks/#b2", 3, 2)
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("compares path segments, not string prefixes", () => {
  // `rows/#r1` must not be read as containing `rows/#r10`, which a bare
  // startsWith would say it does.
  const ops = [set("rows/#r1", 2, 1), insert("rows/#r10", "b2"), set("rows/#r1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("rows/#r1", 3, 1));
});

test("never folds text ops", () => {
  // Their offsets are stated against the string each one produced, so merging
  // them means recomputing offsets — the transform this design avoids.
  const ops: Op[] = [
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 0, insert: "a", remove: "" },
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 1, insert: "b", remove: "" }
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("never folds inserts, removes or moves", () => {
  const ops: Op[] = [insert("rows", "r1"), insert("rows", "r2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("preserves order of what it does not fold", () => {
  const ops = [insert("rows", "r1"), set("page/size", "a4", "letter"), insert("rows", "r2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("an empty buffer folds to nothing", () => {
  assert.deepEqual(coalesce([]), []);
});

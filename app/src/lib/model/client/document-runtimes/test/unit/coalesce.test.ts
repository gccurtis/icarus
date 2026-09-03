import assert from "node:assert/strict";
import { test } from "vitest";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { coalesce } from "$model/client/document-runtimes/methods/flush/coalesce";

const set = (path: string, value: unknown, was: unknown): DocumentOp => ({
  op: "set",
  target: "row",
  path,
  value,
  was
});

const insert = (path: string, id: string): DocumentOp => ({
  op: "insert",
  target: "row",
  path,
  ids: [id],
  after: null,
  values: [{ id }]
});

test("folds a run of sets on one path", () => {
  const folded = coalesce([set("rows/#r1", 2, 1), set("rows/#r1", 3, 2), set("rows/#r1", 4, 3)]);

  assert.equal(folded.length, 1);
  assert.deepEqual(folded[0], set("rows/#r1", 4, 1));
});

test("keeps the last value and the FIRST was", () => {
  const folded = coalesce([set("rows/#r1", 2, 1), set("rows/#r1", 9, 2)]);

  assert.equal((folded[0] as Extract<DocumentOp, { op: "set" }>).value, 9);
  assert.equal((folded[0] as Extract<DocumentOp, { op: "set" }>).was, 1);
});

test("does not fold sets on different paths", () => {
  const ops = [set("rows/#r1", 2, 1), set("rows/#r2", "a4", "letter")];

  assert.deepEqual(coalesce(ops), ops);
});

test("folds across an unrelated op between them", () => {
  const ops = [set("rows/#r1", 2, 1), set("rows/#r2", "a4", "letter"), set("rows/#r1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("rows/#r1", 3, 1));
});

test("refuses to fold across an op on the same path", () => {
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
  const ops = [set("rows/#r1", 2, 1), insert("rows/#r10", "b2"), set("rows/#r1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("rows/#r1", 3, 1));
});

test("folds text ops whose regions touch", () => {
  const ops: DocumentOp[] = [
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 0, insert: "a", remove: "" },
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 1, insert: "b", remove: "" }
  ];

  assert.deepEqual(coalesce(ops), [
    { op: "text", target: "atom", path: "rows/#r1/atoms/#a1", at: 0, insert: "ab", remove: "" }
  ]);
});

test("never folds inserts, removes or moves", () => {
  const ops: DocumentOp[] = [insert("rows", "r1"), insert("rows", "r2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("preserves order of what it does not fold", () => {
  const ops = [insert("rows", "r1"), set("rows/#r9", "a4", "letter"), insert("rows", "r2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("an empty buffer folds to nothing", () => {
  assert.deepEqual(coalesce([]), []);
});

const splice = (path: string, at: number, insert: string, remove: string): DocumentOp => ({
  op: "text",
  target: "atom",
  path,
  at,
  insert,
  remove
});

test("typing a word folds into one splice", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 0, "h", ""),
    splice("#b1/atoms/#a1", 1, "e", ""),
    splice("#b1/atoms/#a1", 2, "l", ""),
    splice("#b1/atoms/#a1", 3, "l", ""),
    splice("#b1/atoms/#a1", 4, "o", "")
  ]);

  assert.deepEqual(folded, [splice("#b1/atoms/#a1", 0, "hello", "")]);
});

test("backspacing over what was just typed cancels it out", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 3, "d", ""),
    splice("#b1/atoms/#a1", 3, "", "d")
  ]);

  assert.deepEqual(folded, []);
});

test("backspacing past what was typed reaches the original text", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 3, "d", ""),
    splice("#b1/atoms/#a1", 3, "", "d"),
    splice("#b1/atoms/#a1", 2, "", "c")
  ]);

  assert.deepEqual(folded, [splice("#b1/atoms/#a1", 2, "", "c")]);
});

test("typing then deleting half of it is one small splice", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 0, "hello", ""),
    splice("#b1/atoms/#a1", 3, "", "lo")
  ]);

  assert.deepEqual(folded, [splice("#b1/atoms/#a1", 0, "hel", "")]);
});

test("a caret that jumps within one atom starts a new splice", () => {
  const ops = [splice("#b1/atoms/#a1", 0, "a", ""), splice("#b1/atoms/#a1", 40, "b", "")];

  assert.deepEqual(coalesce(ops), ops);
});

test("two atoms are two splices", () => {
  const ops = [splice("#b1/atoms/#a1", 0, "a", ""), splice("#b1/atoms/#a2", 0, "b", "")];

  assert.deepEqual(coalesce(ops), ops);
});

test("a splice does not fold across an op on related ground", () => {
  const ops = [
    splice("#b1/atoms/#a1", 0, "a", ""),
    insert("#b1/atoms", "#a2"),
    splice("#b1/atoms/#a1", 1, "b", "")
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("a splice folds across an op on unrelated ground", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 0, "a", ""),
    insert("#b9/atoms", "#a9"),
    splice("#b1/atoms/#a1", 1, "b", "")
  ]);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], splice("#b1/atoms/#a1", 0, "ab", ""));
});

test("a fold inverts to where the run started, not to the middle of it", () => {
  const folded = coalesce([
    splice("#b1/atoms/#a1", 2, "X", "c"),
    splice("#b1/atoms/#a1", 3, "Y", "")
  ]);

  assert.deepEqual(folded, [splice("#b1/atoms/#a1", 2, "XY", "c")]);
});

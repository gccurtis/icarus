import assert from "node:assert/strict";
import { test } from "vitest";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import { coalesce } from "$model/client/presentation-runtimes/methods/flush/coalesce";

const set = (path: string, value: unknown, was: unknown): PresentationOp => ({
  op: "set",
  target: "slide",
  path,
  value,
  was
});

const insert = (path: string, id: string): PresentationOp => ({
  op: "insert",
  target: "slide",
  path,
  ids: [id],
  after: null,
  values: [{ id }]
});

test("folds a run of sets on one path", () => {
  const folded = coalesce([
    set("slides/#s1", 2, 1),
    set("slides/#s1", 3, 2),
    set("slides/#s1", 4, 3)
  ]);

  assert.equal(folded.length, 1);
  assert.deepEqual(folded[0], set("slides/#s1", 4, 1));
});

test("keeps the last value and the FIRST was", () => {
  const folded = coalesce([set("slides/#s1", 2, 1), set("slides/#s1", 9, 2)]);

  assert.equal((folded[0] as Extract<PresentationOp, { op: "set" }>).value, 9);
  assert.equal((folded[0] as Extract<PresentationOp, { op: "set" }>).was, 1);
});

test("does not fold sets on different paths", () => {
  const ops = [set("slides/#s1", 2, 1), set("slides/#s2", "wide", "tall")];

  assert.deepEqual(coalesce(ops), ops);
});

test("folds across an unrelated op between them", () => {
  const ops = [set("slides/#s1", 2, 1), set("slides/#s2", "wide", "tall"), set("slides/#s1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("slides/#s1", 3, 1));
});

test("refuses to fold across an op on the same path", () => {
  const ops = [set("slides/#s1", 2, 1), insert("slides/#s1", "e2"), set("slides/#s1", 3, 2)];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground beneath it", () => {
  const ops = [
    set("slides/#s1", 2, 1),
    insert("slides/#s1/elements", "e2"),
    set("slides/#s1", 3, 2)
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground above it", () => {
  const ops = [
    set("slides/#s1/elements/#e2", 2, 1),
    insert("slides/#s1", "e3"),
    set("slides/#s1/elements/#e2", 3, 2)
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("compares path segments, not string prefixes", () => {
  const ops = [set("slides/#s1", 2, 1), insert("slides/#s10", "e2"), set("slides/#s1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], set("slides/#s1", 3, 1));
});

test("never folds text ops", () => {
  const ops: PresentationOp[] = [
    { op: "text", target: "atom", path: "slides/#s1/atoms/#a1", at: 0, insert: "a", remove: "" },
    { op: "text", target: "atom", path: "slides/#s1/atoms/#a1", at: 1, insert: "b", remove: "" }
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("never folds inserts, removes or moves", () => {
  const ops: PresentationOp[] = [insert("slides", "s1"), insert("slides", "s2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("preserves order of what it does not fold", () => {
  const ops = [insert("slides", "s1"), set("sections/#c1", "Intro", "Untitled"), insert("slides", "s2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("an empty buffer folds to nothing", () => {
  assert.deepEqual(coalesce([]), []);
});

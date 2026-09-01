import assert from "node:assert/strict";
import { test } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import { coalesce } from "$model/client/spreadsheet-runtimes/methods/flush/coalesce";

const cell = (path: string, value: unknown, was: unknown): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path,
  value,
  was
});

const rule = (path: string, value: unknown, was: unknown): SpreadsheetOp => ({
  op: "set",
  target: "formatRule",
  path,
  value,
  was
});

const insert = (path: string, id: string): SpreadsheetOp => ({
  op: "insert",
  target: "formatRule",
  path,
  ids: [id],
  after: null,
  values: [{ id }]
});

const addRow = (id: string): SpreadsheetOp => ({
  op: "insert",
  target: "gridRow",
  path: "rows",
  ids: [id],
  after: null,
  values: [{ id }]
});

const moveRow = (id: string, after: string | null): SpreadsheetOp => ({
  op: "move",
  target: "gridRow",
  path: "rows",
  id,
  after,
  wasAfter: null
});

test("folds a run of sets on one path", () => {
  const folded = coalesce([cell("cells/#A1", 2, 1), cell("cells/#A1", 3, 2), cell("cells/#A1", 4, 3)]);

  assert.equal(folded.length, 1);
  assert.deepEqual(folded[0], cell("cells/#A1", 4, 1));
});

test("keeps the last value and the FIRST was", () => {
  // The asymmetry is the rule. `value` is where the run ended, `was` is where it
  // started — keeping the later `was` would produce an op that inverts to an
  // intermediate state the server never held.
  const folded = coalesce([cell("cells/#A1", 2, 1), cell("cells/#A1", 9, 2)]);

  assert.equal((folded[0] as Extract<SpreadsheetOp, { op: "set" }>).value, 9);
  assert.equal((folded[0] as Extract<SpreadsheetOp, { op: "set" }>).was, 1);
});

test("does not fold sets on different paths", () => {
  const ops = [cell("cells/#A1", 2, 1), cell("cells/#B2", "=SUM(A:A)", "")];

  assert.deepEqual(coalesce(ops), ops);
});

test("folds across an unrelated op between them", () => {
  const ops = [cell("cells/#A1", 2, 1), cell("cells/#B2", 7, 6), cell("cells/#A1", 3, 2)];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], cell("cells/#A1", 3, 1));
});

test("refuses to fold across an op on the same path", () => {
  // Merging moves the later set earlier, which is only sound if nothing in
  // between could have changed what it applies to.
  const ops = [rule("formatRules/#f1", 2, 1), insert("formatRules/#f1", "f2"), rule("formatRules/#f1", 3, 2)];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground beneath it", () => {
  const ops = [
    rule("formatRules/#f1", 2, 1),
    insert("formatRules/#f1/parts", "p2"),
    rule("formatRules/#f1", 3, 2)
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("refuses to fold across an op on ground above it", () => {
  const ops = [
    rule("formatRules/#f1/parts/#p2", 2, 1),
    insert("formatRules/#f1", "p3"),
    rule("formatRules/#f1/parts/#p2", 3, 2)
  ];

  assert.deepEqual(coalesce(ops), ops);
});

test("compares path segments, not string prefixes", () => {
  // `formatRules/#f1` must not be read as containing `formatRules/#f10`, which a
  // bare startsWith would say it does.
  const ops = [
    rule("formatRules/#f1", 2, 1),
    insert("formatRules/#f10", "f11"),
    rule("formatRules/#f1", 3, 2)
  ];
  const folded = coalesce(ops);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0], rule("formatRules/#f1", 3, 1));
});

test("never folds moves, even two on one path", () => {
  // Where a `text` op would sit in a document. Each move states its `after`
  // against the order the one before it produced, so merging them means
  // recomputing positions — the transform this design avoids.
  const ops: SpreadsheetOp[] = [moveRow("g3", "g1"), moveRow("g3", "g5")];

  assert.deepEqual(coalesce(ops), ops);
});

test("never folds inserts or removes", () => {
  const ops: SpreadsheetOp[] = [addRow("g1"), addRow("g2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("preserves order of what it does not fold", () => {
  const ops = [addRow("g1"), cell("cells/#A1", 4, 3), addRow("g2")];

  assert.deepEqual(coalesce(ops), ops);
});

test("an empty buffer folds to nothing", () => {
  assert.deepEqual(coalesce([]), []);
});

import assert from "node:assert/strict";
import { test } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import { invert, invertAll } from "$model/client/spreadsheet-runtimes/methods/history/invert";

test("a set exchanges value and was", () => {
  const op: SpreadsheetOp = { op: "set", target: "cell", path: "cells/#A1", value: 3, was: 1 };

  assert.deepEqual(invert(op), { op: "set", target: "cell", path: "cells/#A1", value: 1, was: 3 });
});

test("clearing a cell is a set, and inverts like one", () => {
  const op: SpreadsheetOp = { op: "set", target: "cell", path: "cells/#A1", value: null, was: 42 };

  assert.deepEqual(invert(op), { op: "set", target: "cell", path: "cells/#A1", value: 42, was: null });
});

test("an insert inverts to a remove naming the same ids", () => {
  const op: SpreadsheetOp = {
    op: "insert",
    target: "gridRow",
    path: "rows",
    ids: ["g1", "g2"],
    after: "g0",
    values: [{ id: "g1" }, { id: "g2" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "remove" });
});

test("a remove inverts to an insert putting the same values back", () => {
  const op: SpreadsheetOp = {
    op: "remove",
    target: "gridColumn",
    path: "columns",
    ids: ["c1"],
    after: "c0",
    values: [{ id: "c1" }]
  };

  assert.deepEqual(invert(op), { ...op, op: "insert" });
});

test("a move exchanges after and wasAfter", () => {
  const op: SpreadsheetOp = {
    op: "move",
    target: "gridRow",
    path: "rows",
    id: "g3",
    after: "g1",
    wasAfter: null
  };

  assert.deepEqual(invert(op), { ...op, after: null, wasAfter: "g1" });
});

test("inverting twice returns the original", () => {
  const ops: SpreadsheetOp[] = [
    { op: "set", target: "cell", path: "cells/#A1", value: 2, was: 1 },
    { op: "insert", target: "gridRow", path: "rows", ids: ["g1"], after: null, values: [{ id: "g1" }] },
    {
      op: "remove",
      target: "formatRule",
      path: "formatRules",
      ids: ["f2"],
      after: "f1",
      values: [{ id: "f2" }]
    },
    { op: "move", target: "gridColumn", path: "columns", id: "c1", after: "c2", wasAfter: null }
  ];

  for (const op of ops) assert.deepEqual(invert(invert(op)), op);
});

test("inverting never reads a value or resolves a path", () => {
  const op: SpreadsheetOp = {
    op: "set",
    target: "mark",
    path: "cells/#A1/marks/#m1",
    value: Symbol.for("opaque"),
    was: { arbitrary: { nested: [1, 2, 3] } }
  };

  const inverted = invert(op) as Extract<SpreadsheetOp, { op: "set" }>;

  assert.deepEqual(inverted.value, { arbitrary: { nested: [1, 2, 3] } });
  assert.equal(inverted.was, Symbol.for("opaque"));
  assert.equal(inverted.path, op.path);
});

test("a gesture is inverted in reverse order", () => {
  const gesture: SpreadsheetOp[] = [
    { op: "set", target: "cell", path: "cells/#A1", value: 2, was: 1 },
    { op: "set", target: "cell", path: "cells/#A2", value: 20, was: 10 }
  ];

  const undone = invertAll(gesture);

  assert.equal(undone[0].path, "cells/#A2");
  assert.equal(undone[1].path, "cells/#A1");
});

test("inverting a gesture leaves the original untouched", () => {
  const gesture: SpreadsheetOp[] = [
    { op: "set", target: "cell", path: "cells/#A1", value: 2, was: 1 },
    { op: "set", target: "cell", path: "cells/#B1", value: 4, was: 3 }
  ];

  invertAll(gesture);

  assert.equal(gesture[0].path, "cells/#A1");
});

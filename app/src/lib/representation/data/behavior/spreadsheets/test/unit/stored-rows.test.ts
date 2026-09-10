import { describe, expect, it } from "vitest";

import { isStoredSpreadsheetChangeSet } from "$representation/data/behavior/spreadsheets/stored-rows";

const row = (ops: Array<Record<string, unknown>>) => ({
  _id: "spreadsheetChangeSets:one",
  _creationTime: 1,
  projectId: "projects:one",
  resourceId: "spreadsheets:one",
  revision: 2,
  baseRevision: 1,
  tier: "recent",
  ops,
  touched: [...new Set(ops.map((op) => op.path))],
  actor: { kind: "system" },
  at: 2
});

describe("stored spreadsheet change sets", () => {
  it("admits every exact operation arm", () => {
    expect(isStoredSpreadsheetChangeSet(row([
      { op: "set", target: "cell", path: "row/column", value: { value: 1 }, was: null },
      { op: "insert", target: "gridRow", path: "rows", ids: ["row"], after: null, values: [{}] },
      { op: "remove", target: "mark", path: "row/column/marks", ids: ["mark"], after: null, values: [] },
      { op: "move", target: "gridColumn", path: "columns", id: "column", after: null, wasAfter: "old" }
    ]))).toBe(true);
  });

  it("keeps set and list target vocabularies distinct", () => {
    expect(isStoredSpreadsheetChangeSet(row([
      { op: "set", target: "gridRow", path: "rows/one", value: 1, was: 0 }
    ]))).toBe(false);
    expect(isStoredSpreadsheetChangeSet(row([
      { op: "insert", target: "cell", path: "cells", ids: ["cell"], after: null, values: [{}] }
    ]))).toBe(false);
  });
});

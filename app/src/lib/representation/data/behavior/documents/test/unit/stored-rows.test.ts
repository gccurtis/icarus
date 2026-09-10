import { describe, expect, it } from "vitest";

import { isStoredDocumentChangeSet } from "$representation/data/behavior/documents/stored-rows";

const row = (ops: Array<Record<string, unknown>>) => ({
  _id: "documentChangeSets:one",
  _creationTime: 1,
  projectId: "projects:one",
  resourceId: "documents:one",
  revision: 2,
  baseRevision: 1,
  tier: "recent",
  ops,
  touched: [...new Set(ops.map((op) => op.path))],
  actor: { kind: "system" },
  at: 2
});

describe("stored document change sets", () => {
  it("admits every exact operation arm", () => {
    expect(isStoredDocumentChangeSet(row([
      { op: "set", target: "document", path: "styles", value: {}, was: null },
      { op: "insert", target: "block", path: "row/blocks", ids: ["block"], after: null, values: [{}] },
      { op: "remove", target: "mark", path: "block/marks", ids: ["mark"], after: null, values: [] },
      { op: "move", target: "row", path: "rows", id: "row", after: null, wasAfter: "before" },
      { op: "text", target: "atom", path: "block/atoms/atom", at: 0, insert: "a", remove: "" }
    ]))).toBe(true);
  });

  it("rejects missing, extra, coercible, and non-round-tripping shapes", () => {
    expect(isStoredDocumentChangeSet(row([
      { op: "set", path: "title", value: "Now", was: "Before" }
    ]))).toBe(false);
    expect(isStoredDocumentChangeSet(row([
      { op: "set", target: "document", path: "title", value: "Now", was: "Before", oldTarget: "row" }
    ]))).toBe(false);
    expect(isStoredDocumentChangeSet(row([
      {
        op: "set",
        target: "document",
        path: "title",
        value: { toString: () => "coerced" },
        was: null
      }
    ]))).toBe(false);
  });

  it("rejects impossible revision and touched-path envelopes", () => {
    const candidate = row([
      { op: "set", target: "document", path: "title", value: "Now", was: "Before" }
    ]);
    expect(isStoredDocumentChangeSet({ ...candidate, revision: 1, baseRevision: 1 })).toBe(false);
    expect(isStoredDocumentChangeSet({ ...candidate, touched: ["other"] })).toBe(false);
    expect(isStoredDocumentChangeSet({ ...candidate, retiredOps: [] })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { isStoredPresentationChangeSet } from "$representation/data/behavior/presentations/stored-rows";

const row = (ops: Array<Record<string, unknown>>) => ({
  _id: "presentationChangeSets:one",
  _creationTime: 1,
  projectId: "projects:one",
  resourceId: "presentations:one",
  revision: 2,
  baseRevision: 1,
  tier: "recent",
  ops,
  touched: [...new Set(ops.map((op) => op.path))],
  actor: { kind: "system" },
  at: 2
});

describe("stored presentation change sets", () => {
  it("admits every exact operation arm with a required set target", () => {
    expect(isStoredPresentationChangeSet(row([
      { op: "set", target: "presentation", path: "theme/background", value: { kind: "color" }, was: null },
      { op: "set", target: "element", path: "element/frame", value: { y: 1 }, was: null },
      { op: "insert", target: "slide", path: "slides", ids: ["slide"], after: null, values: [{}] },
      { op: "remove", target: "atom", path: "block/atoms", ids: ["atom"], after: null, values: [] },
      { op: "move", target: "layout", path: "layouts", id: "layout", after: null, wasAfter: "old" },
      { op: "text", target: "atom", path: "block/atoms/atom", at: 1, insert: "", remove: "a" }
    ]))).toBe(true);
  });

  it("rejects a missing, undefined or unknown set target", () => {
    expect(isStoredPresentationChangeSet(row([
      { op: "set", path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
    expect(isStoredPresentationChangeSet(row([
      { op: "set", target: undefined, path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
    expect(isStoredPresentationChangeSet(row([
      { op: "set", target: "legacy-presentation", path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
  });

  it("rejects unknown operation fields", () => {
    expect(isStoredPresentationChangeSet(row([
      { op: "text", target: "atom", path: "atom", at: 0, insert: "a", remove: "", oldText: "" }
    ]))).toBe(false);
  });
});

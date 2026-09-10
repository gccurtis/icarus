import { describe, expect, it } from "vitest";

import { isStoredSlideDeckChangeSet } from "$representation/data/behavior/slide-decks/stored-rows";

const row = (ops: Array<Record<string, unknown>>) => ({
  _id: "slideDeckChangeSets:one",
  _creationTime: 1,
  projectId: "projects:one",
  resourceId: "slideDecks:one",
  revision: 2,
  baseRevision: 1,
  tier: "recent",
  ops,
  touched: [...new Set(ops.map((op) => op.path))],
  actor: { kind: "system" },
  at: 2
});

describe("stored slide-deck change sets", () => {
  it("admits every exact operation arm with a required set target", () => {
    expect(isStoredSlideDeckChangeSet(row([
      { op: "set", target: "deck", path: "theme/background", value: { kind: "color" }, was: null },
      { op: "set", target: "element", path: "element/frame", value: { y: 1 }, was: null },
      { op: "insert", target: "slide", path: "slides", ids: ["slide"], after: null, values: [{}] },
      { op: "remove", target: "atom", path: "block/atoms", ids: ["atom"], after: null, values: [] },
      { op: "move", target: "layout", path: "layouts", id: "layout", after: null, wasAfter: "old" },
      { op: "text", target: "atom", path: "block/atoms/atom", at: 1, insert: "", remove: "a" }
    ]))).toBe(true);
  });

  it("rejects a missing, undefined or unknown set target", () => {
    expect(isStoredSlideDeckChangeSet(row([
      { op: "set", path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
    expect(isStoredSlideDeckChangeSet(row([
      { op: "set", target: undefined, path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
    expect(isStoredSlideDeckChangeSet(row([
      { op: "set", target: "legacy-deck", path: "slide/frame", value: {}, was: null }
    ]))).toBe(false);
  });

  it("rejects unknown operation fields", () => {
    expect(isStoredSlideDeckChangeSet(row([
      { op: "text", target: "atom", path: "atom", at: 0, insert: "a", remove: "", oldText: "" }
    ]))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { nodeId } from "$knowledge/api/cluster/node-id";
import { windowId } from "$knowledge/api/shared/ingest/window-id";

describe("nodeId", () => {
  it("hashes the sorted member ids, so member order cannot change identity", () => {
    // Re-clustering that produces the same grouping produces the same id, which
    // is what lets repair recognize an unchanged cluster instead of churning it.
    expect(nodeId(["b", "a", "c"])).toBe(nodeId(["a", "c", "b"]));
  });

  it("changes when the membership changes", () => {
    expect(nodeId(["a", "b"])).not.toBe(nodeId(["a", "b", "c"]));
    expect(nodeId(["a", "b"])).not.toBe(nodeId(["a", "z"]));
  });

  it("cannot be read as a window id, so descent needs no lookup to tell them apart", () => {
    const window = windowId({ kind: "document", id: "documents:1" as Id<"documents"> }, "text");

    expect(nodeId(["a", "b"]).startsWith("n:")).toBe(true);
    expect(window.startsWith("w:")).toBe(true);
  });
});

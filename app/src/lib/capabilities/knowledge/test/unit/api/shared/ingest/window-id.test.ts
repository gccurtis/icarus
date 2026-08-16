import { describe, expect, it } from "vitest";
import { windowId } from "$knowledge/api/shared/ingest/window-id";
import type { LatticeSource } from "$knowledge/types/lattice-source";

const document = (id: string): LatticeSource => ({ kind: "document", id: id as never });

describe("windowId", () => {
  it("is the same for the same text in the same source", () => {
    // This is what makes editing affordable: reuse is decided by comparing
    // these, so an unchanged window keeps its vector and is never re-embedded.
    expect(windowId(document("documents:1"), "the margin fell")).toBe(
      windowId(document("documents:1"), "the margin fell")
    );
  });

  it("changes when the text changes, however slightly", () => {
    expect(windowId(document("documents:1"), "the margin fell")).not.toBe(
      windowId(document("documents:1"), "the margin fell.")
    );
  });

  it("separates the same text in two sources", () => {
    expect(windowId(document("documents:1"), "shared boilerplate")).not.toBe(
      windowId(document("documents:2"), "shared boilerplate")
    );
  });

  it("separates two kinds that happen to share an id", () => {
    const asFinding: LatticeSource = { kind: "finding", id: "documents:1" as never };

    expect(windowId(document("documents:1"), "same words")).not.toBe(
      windowId(asFinding, "same words")
    );
  });

  it("cannot be confused with a delimiter shift in the source id", () => {
    // Concatenating without a separator would make ("ab", "c") and ("a", "bc")
    // the same window, which would silently hand one source another's vector.
    expect(windowId(document("documents:1"), "x")).not.toBe(
      windowId(document("documents:"), "1x")
    );
  });

  it("marks itself a window, so descent can tell one from a cluster", () => {
    expect(windowId(document("documents:1"), "anything")).toMatch(/^w:[0-9a-f]{32}$/);
  });
});

import { describe, expect, it } from "vitest";
import { latticeStateValidator, rebuildReasonValidator } from "$knowledge/types/lattice-version";

describe("latticeStateValidator", () => {
  it("tells clustering apart from rebuilding", () => {
    // They are not the same readiness: a lattice mid-clustering has coherent
    // level-0 vectors and an incomplete hierarchy, which is usable for flat
    // retrieval and not for hierarchical. One mid-rebuild is usable for neither.
    expect(latticeStateValidator.members.map((member) => member.value).sort()).toEqual([
      "building",
      "clustering",
      "error",
      "ready",
      "rebuilding"
    ]);
  });
});

describe("rebuildReasonValidator", () => {
  it("names the three reasons an index is thrown away", () => {
    expect(rebuildReasonValidator.members.map((member) => member.value).sort()).toEqual([
      "corruption",
      "embedding_changed",
      "manual"
    ]);
  });
});

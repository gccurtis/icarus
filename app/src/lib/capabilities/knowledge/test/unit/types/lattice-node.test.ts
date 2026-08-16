import { describe, expect, it } from "vitest";
import { latticeWindowValidator } from "$knowledge/types/lattice-node";

describe("latticeWindowValidator", () => {
  it("names a span of one source and how many windows merged into it", () => {
    expect(Object.keys(latticeWindowValidator.fields).sort()).toEqual([
      "density",
      "end",
      "source",
      "start"
    ]);
  });

  it("requires the density, because an unmerged window is density 1, not unknown", () => {
    // It is what tells a thin thematic link from a document's own argument
    // without re-reading a word, so a window that cannot say is useless for it.
    expect(latticeWindowValidator.fields.density.isOptional).toBe("required");
  });

  it("carries the source on every window, never on the node", () => {
    // A cluster's windows span several sources; hoisting the source to the node
    // would make that unrepresentable, which is the whole corpus tier.
    expect(latticeWindowValidator.fields.source.kind).toBe("union");
  });
});

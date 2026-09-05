import { describe, expect, it } from "vitest";

import {
  changedSemanticSources,
  coalesceSemanticCitations
} from "$representation/data/behavior/semantic/citation";
import type { SemanticCitation } from "$representation/data/types/semantic/derived-output";

const citation = (from: number, to: number, text: string, generation = 4): SemanticCitation => ({
  source: { ref: { kind: "document", id: "brief" }, revision: 7, encoding: "utf-16" },
  span: { from, to, text },
  overlayGeneration: generation
});

describe("semantic citations", () => {
  it("unions overlapping reads but preserves generation boundaries", () => {
    expect(
      coalesceSemanticCitations([
        citation(0, 5, "alpha"),
        citation(3, 10, "ha beta"),
        citation(0, 5, "alpha", 5)
      ])
    ).toEqual([
      citation(0, 10, "alpha beta"),
      citation(0, 5, "alpha", 5)
    ]);
  });

  it("marks only cited source revisions as changed", () => {
    const used = citation(0, 5, "alpha");
    expect(
      changedSemanticSources([used], [
        used.source,
        { ref: { kind: "document", id: "unrelated" }, revision: 99, encoding: "utf-16" }
      ])
    ).toEqual([]);

    expect(
      changedSemanticSources([used], [
        { ...used.source, revision: 8 },
        { ref: { kind: "document", id: "unrelated" }, revision: 100, encoding: "utf-16" }
      ])
    ).toEqual([used.source]);
  });

  it("rejects citations whose text and coordinate system disagree", () => {
    expect(() => coalesceSemanticCitations([citation(0, 4, "alpha")])).toThrow(
      /text does not match/
    );
  });
});

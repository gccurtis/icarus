import { describe, expect, it } from "vitest";

import {
  changedSemanticSources,
  coalesceSemanticCitations
} from "$representation/data/behavior/semantic/citation";
import { asId } from "$representation/data/behavior/core/id";
import type { SemanticTextCitation } from "$representation/data/types/semantic/derived-output";

const citation = (
  from: number,
  to: number,
  text: string,
  generation = 4,
  evidenceId = `evidence-${from}-${to}-${generation}`
): SemanticTextCitation => ({
  evidenceKind: "text",
  selections: [{ evidenceId, use: `Supports ${text}` }],
  source: {
    ref: { kind: "document", id: asId<"documents">("documents:brief") },
    revision: 7,
    encoding: "utf-16"
  },
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
      {
        ...citation(0, 10, "alpha beta", 4, "evidence-0-5-4"),
        selections: [
          { evidenceId: "evidence-0-5-4", use: "Supports alpha" },
          { evidenceId: "evidence-3-10-4", use: "Supports ha beta" }
        ]
      },
      citation(0, 5, "alpha", 5)
    ]);
  });

  it("unions touching evidence selected across tool calls", () => {
    expect(
      coalesceSemanticCitations([
        citation(0, 1, "G"),
        citation(1, 18, "arry's age is 27.")
      ])
    ).toEqual([
      {
        ...citation(0, 18, "Garry's age is 27.", 4, "evidence-0-1-4"),
        selections: [
          { evidenceId: "evidence-0-1-4", use: "Supports G" },
          {
            evidenceId: "evidence-1-18-4",
            use: "Supports arry's age is 27."
          }
        ]
      }
    ]);
  });

  it("preserves hard partitions when citations from different slide reads touch", () => {
    expect(coalesceSemanticCitations([
      { ...citation(0, 5, "First"), partition: "partition:1" },
      { ...citation(5, 13, "\n\nSecond"), partition: "partition:2" }
    ])).toHaveLength(2);
  });

  it("marks only cited source revisions as changed", () => {
    const used = citation(0, 5, "alpha");
    expect(
      changedSemanticSources([used], [
        used.source,
        {
          ref: { kind: "document", id: asId<"documents">("documents:unrelated") },
          revision: 99,
          encoding: "utf-16"
        }
      ])
    ).toEqual([]);

    expect(
      changedSemanticSources([used], [
        { ...used.source, revision: 8 },
        {
          ref: { kind: "document", id: asId<"documents">("documents:unrelated") },
          revision: 100,
          encoding: "utf-16"
        }
      ])
    ).toEqual([used.source]);
  });

  it("treats an immutable external text hash as part of source freshness", () => {
    const used: SemanticTextCitation = {
      ...citation(0, 5, "alpha"),
      source: {
        ref: {
          kind: "externalFile::text",
          id: asId<"externalFiles">("externalFiles:notes")
        },
        revision: 0,
        contentHash: "a".repeat(64),
        encoding: "utf-16"
      }
    };

    expect(changedSemanticSources([used], [{
      ...used.source,
      contentHash: "b".repeat(64)
    }])).toEqual([used.source]);
  });

  it("rejects citations whose text and coordinate system disagree", () => {
    expect(() => coalesceSemanticCitations([citation(0, 4, "alpha")])).toThrow(
      /text does not match/
    );
  });
});

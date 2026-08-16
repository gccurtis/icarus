import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS, knowledgeTables } from "$knowledge/schema";

/**
 * A vector index is not readable through the experimental `" indexes"()`
 * accessor, so the test reaches for the definition's own export — the same shape
 * the framework pushes. Cast because the method is internal to Convex's types.
 */
type VectorIndex = {
  indexDescriptor: string;
  vectorField: string;
  dimensions: number;
  filterFields: string[];
};

const vectorIndexesOf = (table: unknown): VectorIndex[] =>
  (table as { export: () => { vectorIndexes: VectorIndex[] } }).export().vectorIndexes;

describe("latticeNodes schema", () => {
  it("leads every index with projectId", () => {
    const indexes = knowledgeTables.latticeNodes[" indexes"]();

    expect(indexes.map((index) => index.indexDescriptor).sort()).toEqual([
      "by_parent",
      "by_project_clustered",
      "by_project_level",
      "by_tier_source"
    ]);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds a level, its windows, and its centroid", () => {
    const fields = Object.keys(knowledgeTables.latticeNodes.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "level",
        "tierSourceId",
        "clustered",
        "windows",
        "text",
        "centroid",
        "count",
        "cohesion",
        "tokens",
        "members",
        "parentId",
        "staleAt",
        "updatedAt"
      ].sort()
    );
  });

  it("stores `clustered` rather than deriving it, because it is an index key", () => {
    // by_project_clustered answers the first question of every clustering pass
    // and every query. Built on the absence of parentId it would be a scan.
    const clustered = knowledgeTables.latticeNodes[" indexes"]().find(
      (index) => index.indexDescriptor === "by_project_clustered"
    );

    expect(clustered?.fields.slice(0, 2)).toEqual(["projectId", "clustered"]);
    expect(knowledgeTables.latticeNodes.validator.fields.clustered.isOptional).toBe("required");
  });

  it("indexes the centroid as a vector, filterable by project", () => {
    const [index, ...rest] = vectorIndexesOf(knowledgeTables.latticeNodes);

    expect(rest).toEqual([]);
    expect(index.vectorField).toBe("centroid");
    expect(index.filterFields).toEqual(["projectId"]);
    // Declared, not inferred: a Convex vector index takes a literal, which is
    // why one embedding model is pinned rather than chosen per project.
    expect(index.dimensions).toBe(EMBEDDING_DIMENSIONS);
  });
});

describe("latticeVersions schema", () => {
  it("indexes by project, which is the row it is one of", () => {
    const indexes = knowledgeTables.latticeVersions[" indexes"]();

    expect(indexes.map((index) => index.indexDescriptor)).toEqual(["by_project"]);
    expect(indexes[0].fields[0]).toBe("projectId");
  });

  it("stores the binding beside the model it resolved to", () => {
    const fields = Object.keys(knowledgeTables.latticeVersions.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "version",
        "embeddingModel",
        "embeddingBinding",
        "dimensions",
        "levelCount",
        "nodeCount",
        "nodesByLevel",
        "staleCount",
        "state",
        "error",
        "rebuildReason",
        "updatedAt"
      ].sort()
    );
  });
});

describe("latticeSources schema", () => {
  it("leads its index with projectId and names the source under it", () => {
    const indexes = knowledgeTables.latticeSources[" indexes"]();

    expect(indexes.map((index) => index.indexDescriptor)).toEqual(["by_project_source"]);
    expect(indexes[0].fields).toEqual(["projectId", "source.kind", "source.id"]);
  });

  it("keeps the revision that was last indexed, which is what lets one be skipped", () => {
    const fields = Object.keys(knowledgeTables.latticeSources.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "source", "revision", "windowCount", "indexedAt"].sort()
    );
  });
});

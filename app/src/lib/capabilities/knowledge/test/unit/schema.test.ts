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

describe("latticeLevelIndexes schema", () => {
  it("leads its index with projectId and names the level under it", () => {
    const indexes = knowledgeTables.latticeLevelIndexes[" indexes"]();

    expect(indexes.map((index) => index.indexDescriptor)).toEqual(["by_project_level"]);
    expect(indexes[0].fields).toEqual(["projectId", "level"]);
  });

  it("stores the parameters it was built under beside the basis", () => {
    const fields = Object.keys(knowledgeTables.latticeLevelIndexes.validator.fields).sort();

    // `threshold` and `k` are what make the rest safe: an index fitted under
    // other parameters is recognizable as stale rather than silently mixed with
    // one that is not.
    expect(fields).toEqual(
      ["projectId", "level", "threshold", "k", "basis", "centroids", "updatedAt"].sort()
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

describe("latticeEdges schema", () => {
  it("reaches an edge from either end, and leads both indexes with projectId", () => {
    const indexes = knowledgeTables.latticeEdges[" indexes"]();

    // One row per pair, read from whichever end is being asked about. Two rows
    // per pair would double the write and let the two disagree.
    expect(indexes.map((index) => index.indexDescriptor).sort()).toEqual([
      "by_from_level",
      "by_to_level"
    ]);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("names the two nodes, the generation, and the weight", () => {
    const fields = Object.keys(knowledgeTables.latticeEdges.validator.fields).sort();

    expect(fields).toEqual(["projectId", "level", "fromId", "toId", "weight"].sort());
  });

  it("puts the level under the endpoint, which is the range a neighbour query asks for", () => {
    const indexes = knowledgeTables.latticeEdges[" indexes"]();

    expect(indexes.find((i) => i.indexDescriptor === "by_from_level")?.fields).toEqual([
      "projectId",
      "fromId",
      "level"
    ]);
    expect(indexes.find((i) => i.indexDescriptor === "by_to_level")?.fields).toEqual([
      "projectId",
      "toId",
      "level"
    ]);
  });
});

describe("latticeChanges schema", () => {
  it("indexes by project, which is the only key history is read by", () => {
    const indexes = knowledgeTables.latticeChanges[" indexes"]();

    expect(indexes.map((index) => index.indexDescriptor)).toEqual(["by_project"]);
    expect(indexes[0].fields[0]).toBe("projectId");
  });

  it("holds one cause, a node set per source, and how far up the edit reached", () => {
    const fields = Object.keys(knowledgeTables.latticeChanges.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "version", "cause", "nodeSets", "reclustered", "at"].sort()
    );
  });

  it("counts what was reclustered per level rather than listing it", () => {
    const { reclustered } = knowledgeTables.latticeChanges.validator.fields;

    // A source change cascades upward, so ids would make the row larger than
    // the change and be read by nobody. How far up it reached is the question.
    expect(reclustered.isOptional).toBe("optional");
    expect(reclustered.kind).toBe("array");
    expect((reclustered as { element: { kind: string } }).element.kind).toBe("float64");
  });

  it("counts what a source kept rather than listing it", () => {
    const nodeSets = knowledgeTables.latticeChanges.validator.fields.nodeSets as unknown as {
      element: { fields: Record<string, { kind: string }> };
    };

    expect(nodeSets.element.fields.added.kind).toBe("array");
    expect(nodeSets.element.fields.removed.kind).toBe("array");
    // A small edit to a large document leaves most passages untouched; listing
    // thousands of ids to say "these were fine" is larger than the change.
    expect(nodeSets.element.fields.unchanged.kind).toBe("float64");
    expect(nodeSets.element.fields.modified).toBeUndefined();
  });
});

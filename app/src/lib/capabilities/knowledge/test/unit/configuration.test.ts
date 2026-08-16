import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { NEIGHBOURS_K, PCA_DIMS, PROBE_CELLS } from "$knowledge/api/cluster/candidates";
import { IVF_CELLS, KMEANS_ITERATIONS, KMEANS_SEED } from "$knowledge/api/cluster/cells";
import { CLUSTER_FLOOR, CLUSTER_PERCENTILE, MAX_CLUSTER_POOL } from "$knowledge/api/cluster/level";
import {
  PROJECTION_ITERATIONS,
  PROJECTION_SAMPLE_MAX,
  PROJECTION_SEED
} from "$knowledge/api/cluster/projection";
import { REPAIR_MAX_DRIFT, REPAIR_MAX_FRACTION } from "$knowledge/api/cluster/settle";
import {
  WINDOW_OVERLAP_CHARS,
  WINDOW_TARGET_CHARS
} from "$knowledge/api/shared/ingest/window-text";

/**
 * The tuning numbers live in a YAML file a Convex isolate cannot read, so the
 * ones that decide behaviour are mirrored in the code that uses them. This is
 * what keeps the file authoritative: edit it and this fails.
 */
const knowledge = parse(readFileSync("configuration/knowledge.yaml", "utf8")) as {
  knowledge: {
    windowing: { targetChars: number; overlapChars: number };
    clustering: {
      percentile: number;
      floor: number;
      knn: {
        k: number;
        pcaDims: number;
        cells: number | null;
        probeCells: number;
        maxClusterPool: number;
        repairMaxFraction: number;
        repairMaxDrift: number;
      };
      determinism: {
        projectionSeed: number;
        kmeansSeed: number;
        projectionSampleMax: number;
        projectionIterations: number;
        kmeansIterations: number;
      };
    };
  };
};

describe("windowing configuration", () => {
  it("mirrors the file the isolate cannot read", () => {
    expect(WINDOW_TARGET_CHARS).toBe(knowledge.knowledge.windowing.targetChars);
    expect(WINDOW_OVERLAP_CHARS).toBe(knowledge.knowledge.windowing.overlapChars);
  });

  it("keeps the overlap well under the target", () => {
    // At half the target every window would be mostly its neighbour, and the
    // corpus would be embedded roughly twice for no extra coverage.
    expect(WINDOW_OVERLAP_CHARS).toBeLessThan(WINDOW_TARGET_CHARS / 2);
  });
});

describe("clustering configuration", () => {
  it("mirrors the file the isolate cannot read", () => {
    expect(CLUSTER_PERCENTILE).toBe(knowledge.knowledge.clustering.percentile);
    expect(CLUSTER_FLOOR).toBe(knowledge.knowledge.clustering.floor);
    expect(REPAIR_MAX_FRACTION).toBe(knowledge.knowledge.clustering.knn.repairMaxFraction);
    expect(REPAIR_MAX_DRIFT).toBe(knowledge.knowledge.clustering.knn.repairMaxDrift);
  });

  it("mirrors the candidate search's numbers too", () => {
    const { knn, determinism } = knowledge.knowledge.clustering;

    expect(NEIGHBOURS_K).toBe(knn.k);
    expect(PCA_DIMS).toBe(knn.pcaDims);
    expect(IVF_CELLS).toBe(knn.cells);
    expect(PROBE_CELLS).toBe(knn.probeCells);
    expect(MAX_CLUSTER_POOL).toBe(knn.maxClusterPool);
    expect(PROJECTION_SEED).toBe(determinism.projectionSeed);
    expect(KMEANS_SEED).toBe(determinism.kmeansSeed);
    expect(PROJECTION_SAMPLE_MAX).toBe(determinism.projectionSampleMax);
    expect(PROJECTION_ITERATIONS).toBe(determinism.projectionIterations);
    expect(KMEANS_ITERATIONS).toBe(determinism.kmeansIterations);
  });

  it("leaves the cell count unset, which is what makes it scale with the pool", () => {
    // Null means derive it as roughly the square root of the pool. A fixed
    // number would be right for one corpus size and wrong for every other.
    expect(IVF_CELLS).toBeNull();
  });

  it("keeps the floor a similarity and the percentile a proportion", () => {
    // A percentile above 1 selects nothing and a floor above 1 clusters nothing;
    // both fail as an empty lattice rather than as an error.
    expect(CLUSTER_PERCENTILE).toBeGreaterThan(0);
    expect(CLUSTER_PERCENTILE).toBeLessThan(1);
    expect(CLUSTER_FLOOR).toBeGreaterThan(0);
    expect(CLUSTER_FLOOR).toBeLessThan(1);
  });
});

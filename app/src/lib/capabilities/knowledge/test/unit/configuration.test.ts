import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { NEIGHBOURS_K, PCA_DIMS, PROBE_CELLS } from "$knowledge/api/cluster/candidates";
import { IVF_CELLS, KMEANS_ITERATIONS, KMEANS_SEED } from "$knowledge/api/cluster/cells";
import {
  CLUSTER_FLOOR,
  CLUSTER_PERCENTILE,
  MAX_CLUSTER_POOL,
  THRESHOLD_SAMPLE_MAX
} from "$knowledge/api/cluster/level";
import {
  PROJECTION_ITERATIONS,
  PROJECTION_SAMPLE_MAX,
  PROJECTION_SEED
} from "$knowledge/api/cluster/projection";
import { REPAIR_MAX_DRIFT, REPAIR_MAX_FRACTION } from "$knowledge/api/cluster/settle";
import { CHANGE_HISTORY } from "$knowledge/api/shared/changes";
import {
  WINDOW_OVERLAP_CHARS,
  WINDOW_TARGET_CHARS
} from "$knowledge/api/shared/ingest/window-text";
import { CHAR_BUDGET, TOP_K } from "$knowledge/api/shared/retrieve/admit";
import {
  DESCENT_BEAM,
  DESCENT_THRESHOLD,
  MAX_EXPANSIONS
} from "$knowledge/api/shared/retrieve/descent";

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
        thresholdSampleMax: number;
        projectionIterations: number;
        kmeansIterations: number;
      };
    };
    retrieval: {
      beam: number;
      threshold: number;
      maxExpansions: number;
      charBudget: number;
      topK: number;
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
    expect(THRESHOLD_SAMPLE_MAX).toBe(determinism.thresholdSampleMax);
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

/**
 * Lattice retention sits in the revisions file rather than this one, because it
 * is a retention decision beside the resource ones it is contrasted with — the
 * lattice has no base to advance, and reading the two together is what makes
 * that difference visible.
 */
const revisions = parse(readFileSync("configuration/revisions.yaml", "utf8")) as {
  revisions: { lattice: { changeHistory: number } };
};

describe("lattice history configuration", () => {
  it("mirrors the file the isolate cannot read", () => {
    expect(CHANGE_HISTORY).toBe(revisions.revisions.lattice.changeHistory);
  });

  it("keeps a history to prune, so pruning is a bound rather than a switch", () => {
    // At zero every change row would be written and immediately dropped, which
    // is a table nobody can read and a write nobody can see.
    expect(CHANGE_HISTORY).toBeGreaterThan(0);
  });
});

describe("retrieval configuration", () => {
  it("mirrors the file the isolate cannot read", () => {
    const { retrieval } = knowledge.knowledge;

    expect(DESCENT_BEAM).toBe(retrieval.beam);
    expect(DESCENT_THRESHOLD).toBe(retrieval.threshold);
    expect(MAX_EXPANSIONS).toBe(retrieval.maxExpansions);
    expect(CHAR_BUDGET).toBe(retrieval.charBudget);
    expect(TOP_K).toBe(retrieval.topK);
  });

  it("bounds a query's cost whatever the corpus is", () => {
    // Beam and ceiling together are what make cost independent of corpus size.
    // Either one unset would make a pathological graph a runaway query.
    expect(DESCENT_BEAM).toBeGreaterThan(0);
    expect(MAX_EXPANSIONS).toBeGreaterThan(0);
    expect(Number.isFinite(DESCENT_BEAM * MAX_EXPANSIONS)).toBe(true);
  });

  it("keeps the threshold a similarity", () => {
    // At or below zero every branch is worth opening and nothing is ever
    // refused, which is the fallback scan by another name.
    expect(DESCENT_THRESHOLD).toBeGreaterThan(0);
    expect(DESCENT_THRESHOLD).toBeLessThan(1);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CLUSTER_FLOOR, CLUSTER_PERCENTILE } from "$knowledge/api/cluster/level";
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
      knn: { repairMaxFraction: number; repairMaxDrift: number };
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

  it("keeps the floor a similarity and the percentile a proportion", () => {
    // A percentile above 1 selects nothing and a floor above 1 clusters nothing;
    // both fail as an empty lattice rather than as an error.
    expect(CLUSTER_PERCENTILE).toBeGreaterThan(0);
    expect(CLUSTER_PERCENTILE).toBeLessThan(1);
    expect(CLUSTER_FLOOR).toBeGreaterThan(0);
    expect(CLUSTER_FLOOR).toBeLessThan(1);
  });
});

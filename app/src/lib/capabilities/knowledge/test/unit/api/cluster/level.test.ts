import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { clusterLevel } from "$knowledge/api/cluster/level";
import { nodeId } from "$knowledge/api/cluster/node-id";
import type { ClusterArtifact } from "$knowledge/types/clustering";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { bridgedGroups, tilted } from "$knowledge/test/fixture";

const notes: LatticeSource = { kind: "document", id: "documents:1" as Id<"documents"> };

const artifact = (
  id: string,
  centroid: number[],
  level = 0,
  windows: ClusterArtifact["windows"] = []
): ClusterArtifact => ({ id, level, centroid, windows });

/** The bridged geometry as a pool: two groups, the artifact between them, two loose. */
const bridged = (): ClusterArtifact[] => {
  const { a1, a2, b1, b2, bridge, loner, drifter } = bridgedGroups();
  return [
    artifact("w:a1", a1),
    artifact("w:a2", a2),
    artifact("w:b1", b1),
    artifact("w:b2", b2),
    artifact("w:bridge", bridge),
    artifact("w:drifter", drifter),
    artifact("w:loner", loner)
  ];
};

const BRIDGE_SIMILARITY = Math.cos((10 * Math.PI) / 180) / Math.SQRT2;

describe("clusterLevel", () => {
  it("clusters into overlapping maximal cliques at or above the level's threshold", () => {
    const { clusters } = clusterLevel(bridged());

    // The bridge belongs to both cliques and to neither group. That an artifact
    // can have two parents is what makes this a lattice rather than a tree.
    expect(clusters.map((cluster) => cluster.memberIds)).toEqual([
      ["w:a1", "w:a2", "w:bridge"],
      ["w:b1", "w:b2", "w:bridge"]
    ]);
  });

  it("leaves an artifact with no strong neighbour in no cluster", () => {
    const { orphanIds } = clusterLevel(bridged());

    // Not a failure and not a loose end: it is a root, and the next pass will
    // try it again against whatever exists by then.
    expect(orphanIds).toEqual(["w:drifter", "w:loner"]);
  });

  it("records the weakest pairwise similarity as cohesion, never the mean", () => {
    const [cluster] = clusterLevel(bridged()).clusters;
    const mean = (Math.cos((20 * Math.PI) / 180) + 2 * BRIDGE_SIMILARITY) / 3;

    // A cluster is only as tight as its loosest pair, and this clique is a tight
    // core with something barely related attached — the case averaging hides.
    expect(cluster.cohesion).toBeCloseTo(BRIDGE_SIMILARITY, 12);
    expect(Math.abs(mean - cluster.cohesion)).toBeGreaterThan(0.07);
  });

  it("records the unit-normalized mean as the centroid retrieval scores against", () => {
    const [cluster] = clusterLevel(bridged()).clusters;
    const { a1, a2, bridge } = bridgedGroups();
    const sum = a1.map((_, i) => a1[i] + a2[i] + bridge[i]);
    const length = Math.sqrt(sum.reduce((total, x) => total + x * x, 0));

    expect(cluster.centroid).toEqual(sum.map((x) => x / length));
  });

  it("gives the same grouping the same ids whatever order the pool arrived in", () => {
    const forwards = clusterLevel(bridged());
    const backwards = clusterLevel([...bridged()].reverse());

    // Identity is independent of member order and of when clustering ran, which
    // is what lets repair recognize an unchanged cluster instead of churning it.
    expect(backwards.clusters.map((cluster) => cluster.key)).toEqual(
      forwards.clusters.map((cluster) => cluster.key)
    );
    expect(forwards.clusters[0].key).toBe(nodeId(["w:bridge", "w:a2", "w:a1"]));
  });

  it("counts a cluster's level from its deepest member, so an old orphan can join a new one", () => {
    const { clusters } = clusterLevel([
      artifact("w:window", tilted(0, 1, 0), 0),
      artifact("n:summary", tilted(0, 1, 5), 3)
    ]);

    // A level-3 cluster absorbing a level-0 window is the point: by now there is
    // something for it to relate to that did not exist when it was passed over.
    expect(clusters).toHaveLength(1);
    expect(clusters[0].level).toBe(4);
    expect(clusters[0].memberIds).toEqual(["n:summary", "w:window"]);
  });

  it("merges the windows underneath it rather than concatenating them", () => {
    const { clusters } = clusterLevel([
      artifact("w:one", tilted(0, 1, 0), 0, [{ source: notes, start: 0, end: 100, density: 1 }]),
      artifact("w:two", tilted(0, 1, 5), 0, [{ source: notes, start: 80, end: 200, density: 1 }])
    ]);

    expect(clusters[0].windows).toEqual([{ source: notes, start: 0, end: 200, density: 2 }]);
  });

  it("clusters nothing out of a pool of one", () => {
    const alone = clusterLevel([artifact("w:alone", tilted(0, 1, 0))]);

    expect(alone.clusters).toEqual([]);
    expect(alone.orphanIds).toEqual(["w:alone"]);
  });
});

import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { NEIGHBOURS_K, PCA_DIMS, candidateGraph } from "$knowledge/api/cluster/candidates";
import {
  CLUSTER_FLOOR,
  MAX_CLUSTER_POOL,
  approximateRelation,
  clusterLevel,
  exactRelation,
  levelOf
} from "$knowledge/api/cluster/level";
import { nodeId } from "$knowledge/api/cluster/node-id";
import type { ClusterArtifact } from "$knowledge/types/clustering";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { bridgedGroups, cone, separatedGroups, tilted } from "$knowledge/test/fixture";

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

/** Ids in the pool's own order, so the sorted pool is the vector order. */
const poolOf = (vectors: number[][]): ClusterArtifact[] =>
  vectors.map((centroid, index) => artifact(`w:${String(index).padStart(5, "0")}`, centroid));

/** Wider than the projection keeps, so the basis is a real reduction. */
const structured = () => separatedGroups({ groups: 8, per: 5, width: PCA_DIMS + 32 });

/**
 * Exactly one artifact past the crossover, in groups small enough for a top-`k`
 * graph to hold one whole — a clique can never be larger than the graph's
 * degree, so groups above `NEIGHBOURS_K + 1` would split under *any* threshold.
 * Wide enough that the projection is a real reduction, and separated enough that
 * the candidate search reaches every within-group pair.
 */
const crowded = () => separatedGroups({ groups: 69, per: 29, width: PCA_DIMS + 32 });

describe("the approximate path", () => {
  it("finds the same clusters the exact path finds", () => {
    const vectors = structured();
    const pool = poolOf(vectors);

    const exact = levelOf(pool, exactRelation(vectors));
    const approximate = levelOf(pool, approximateRelation(vectors));

    // Identical, not similar. Node ids hash sorted member ids, so a grouping
    // that differs by one member renames the cluster and everything above it —
    // and cohesion and the centroid have to match too, because both paths score
    // with the full embedding and only the candidate search is approximated.
    expect(approximate.clusters).toEqual(exact.clusters);
    expect(approximate.orphanIds).toEqual(exact.orphanIds);
    expect(exact.clusters).toHaveLength(8);
  });

  it("finds them on a pool the exact path would not have been given", () => {
    const vectors = crowded();
    const pool = poolOf(vectors);

    // The oracle comparison the whole design rests on, run where it means
    // something: above the crossover, on a pool the approximate path would take
    // in production. Below it the candidate graph reaches nearly every pair and
    // the two agree for reasons that say nothing about scale.
    const exact = levelOf(pool, exactRelation(vectors));
    const approximate = levelOf(pool, approximateRelation(vectors));

    expect(vectors).toHaveLength(MAX_CLUSTER_POOL + 1);
    expect(approximate.clusters).toEqual(exact.clusters);
    expect(approximate.orphanIds).toEqual(exact.orphanIds);
    expect(exact.clusters).toHaveLength(69);
  });

  it("reads its threshold off the pool's own pairs, not off the edges it kept", () => {
    const vectors = cone({ count: MAX_CLUSTER_POOL + 1, width: PCA_DIMS + 32 });
    const exact = exactRelation(vectors).threshold;

    // A graph of the strongest `k` neighbours holds the top percent or two of
    // the pool's pairs, so a percentile over *those* measures how similar
    // neighbours are, not how similar "related" has to be — and the projection
    // would end up deciding adjacency, which is the one thing it must not do.
    //
    // A pool with no structure is what makes that visible: its own percentile
    // sits well above the floor, where a structured pool's is clamped to it and
    // any wrong answer is hidden.
    expect(exact).toBeGreaterThan(CLUSTER_FLOOR);
    expect(approximateRelation(vectors).threshold).toBeCloseTo(exact, 1);
  });

  it("calls a pair the search never reached unrelated, however close it is", () => {
    // One artifact short of the fixture above, which is enough for the cell
    // search to miss a few pairs inside a group. That the equality above holds
    // *because* the search reached every pair — rather than because `adjacent`
    // quietly falls back to scoring one — is what this pins.
    const vectors = crowded().slice(0, MAX_CLUSTER_POOL);
    const relation = approximateRelation(vectors);
    const kept = candidateGraph(vectors).neighbours.map(
      (list) => new Set(list.map((neighbour) => neighbour.to))
    );

    let missed: [number, number] | undefined;
    for (let a = 0; a < vectors.length && !missed; a++) {
      // A group is laid out contiguously, so a missed pair is near in id order.
      for (let b = a + 1; b < Math.min(vectors.length, a + 29); b++) {
        if (kept[a].has(b) || relation.similarity(a, b) < relation.threshold) continue;
        missed = [a, b];
        break;
      }
    }

    expect(missed).toBeDefined();
    const [a, b] = missed ?? [0, 0];
    expect(relation.similarity(a, b)).toBeGreaterThanOrEqual(relation.threshold);
    expect(relation.adjacent(a, b)).toBe(false);
  });

  it("answers every similarity with the full embedding, edge or not", () => {
    const vectors = structured();
    const relation = approximateRelation(vectors);
    // Recomputed here rather than imported: the claim is about the arithmetic
    // the relation used, and borrowing its own would not test it.
    const full = (a: number, b: number) => {
      let total = 0;
      for (let i = 0; i < vectors[a].length; i++) total += vectors[a][i] * vectors[b][i];
      return total;
    };

    // Every pair, not only the ones the search kept. A pair the search skipped
    // is outside the *graph*, not outside the arithmetic — so cohesion cannot
    // pick up a projected score by asking about one.
    for (let a = 0; a < vectors.length; a++) {
      for (let b = a + 1; b < vectors.length; b++) {
        expect(relation.similarity(a, b)).toBeCloseTo(full(a, b), 12);
      }
    }
  });

  it("builds the same lattice out of the same pool every time", () => {
    const vectors = structured();

    // Byte-identical rather than equivalent. A lattice that reshuffled on every
    // rebuild would make retrieval irreproducible and repair impossible to
    // reason about, which is why every seed here is fixed and every sample is
    // taken by stride.
    expect(JSON.stringify(levelOf(poolOf(vectors), approximateRelation(vectors)))).toBe(
      JSON.stringify(levelOf(poolOf(vectors), approximateRelation(vectors)))
    );
  });
});

describe("the crossover", () => {
  const crowd = (size: number) => poolOf(crowded().slice(0, size));

  it("compares every pair at the crossover, and fits nothing, so there is no index", () => {
    const exact = clusterLevel(crowd(MAX_CLUSTER_POOL));

    expect(exact.clusters).toHaveLength(69);
    expect(exact.index).toBeUndefined();
  });

  it("projects and buckets one artifact later, and reports what it clustered through", () => {
    const approximate = clusterLevel(crowd(MAX_CLUSTER_POOL + 1));

    // The count is asserted on *both* sides of the crossover on purpose. One
    // artifact more must change what the pass costs and nothing about what it
    // decides; asserting only the index above it would let the grouping change
    // silently, which is exactly how the threshold went wrong once.
    expect(approximate.clusters).toHaveLength(69);

    // The index is what makes changing pcaDims, k, or the cell count a rebuild
    // rather than a migration, and `threshold` and `k` beside the basis are what
    // make one fitted under other parameters recognizable.
    expect(approximate.index?.k).toBe(NEIGHBOURS_K);
    expect(approximate.index?.level).toBe(0);
    expect(approximate.index?.threshold).toBeGreaterThanOrEqual(CLUSTER_FLOOR);
    expect(approximate.index?.centroids).toHaveLength(45);
  });
});

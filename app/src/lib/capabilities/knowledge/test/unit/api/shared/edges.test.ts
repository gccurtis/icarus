import { describe, expect, it } from "vitest";
import { PCA_DIMS } from "$knowledge/api/cluster/candidates";
import { approximateRelation, levelOf } from "$knowledge/api/cluster/level";
import { dropEdges, neighbours, writeEdges } from "$knowledge/api/shared/edges";
import type { ClusterArtifact } from "$knowledge/types/clustering";
import { aNode, asCtx, asking, separatedGroups } from "$knowledge/test/fixture";

const edgeRows = (ctx: { rows: Map<string, Record<string, unknown>> }) =>
  [...ctx.rows.values()].filter((row) => row._table === "latticeEdges");

describe("writeEdges", () => {
  it("writes one row per pair and reaches it from either end", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const b = await aNode(ctx, scope, { centroid: [0, 1] });

    await writeEdges(asCtx(ctx), scope, 0, [a, b], [{ fromId: b, toId: a, weight: 0.7 }]);

    // One row, not two. Two would double every write and let the two halves of
    // one relationship disagree, which is what the second index exists to avoid.
    expect(edgeRows(ctx)).toHaveLength(1);
    expect(await neighbours(asCtx(ctx), scope, a)).toEqual([{ nodeId: b, level: 0, weight: 0.7 }]);
    expect(await neighbours(asCtx(ctx), scope, b)).toEqual([{ nodeId: a, level: 0, weight: 0.7 }]);
  });

  it("stores the generation the pass ran at, which is neither endpoint's own", async () => {
    const { ctx, scope } = await asking();
    // A window that found no home at level 0 is carried into every pool above
    // it, so a pass at level 3 can relate it to a level-2 cluster.
    const orphan = await aNode(ctx, scope, { centroid: [1, 0], level: 0 });
    const cluster = await aNode(ctx, scope, { centroid: [0, 1], level: 2 });

    await writeEdges(
      asCtx(ctx),
      scope,
      3,
      [orphan, cluster],
      [{ fromId: orphan, toId: cluster, weight: 0.5 }]
    );

    expect(await neighbours(asCtx(ctx), scope, orphan)).toEqual([
      { nodeId: cluster, level: 3, weight: 0.5 }
    ]);
    expect((await asCtx(ctx).db.get(orphan))?.level).toBe(0);
    expect((await asCtx(ctx).db.get(cluster))?.level).toBe(2);
  });

  it("answers about one generation when asked for one", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const b = await aNode(ctx, scope, { centroid: [0, 1] });

    await writeEdges(asCtx(ctx), scope, 0, [a, b], [{ fromId: a, toId: b, weight: 0.4 }]);
    await writeEdges(asCtx(ctx), scope, 1, [a, b], [{ fromId: a, toId: b, weight: 0.9 }]);

    // Each generation is its own network, which is why the level is part of the
    // index key rather than a field to filter on.
    expect(await neighbours(asCtx(ctx), scope, a, 1)).toEqual([
      { nodeId: b, level: 1, weight: 0.9 }
    ]);
    expect(await neighbours(asCtx(ctx), scope, a)).toHaveLength(2);
  });

  it("replaces the pool's edges at that generation rather than accumulating them", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const b = await aNode(ctx, scope, { centroid: [0, 1] });
    const c = await aNode(ctx, scope, { centroid: [0, 0, 1] });

    await writeEdges(asCtx(ctx), scope, 0, [a, b, c], [{ fromId: a, toId: b, weight: 0.8 }]);
    await writeEdges(asCtx(ctx), scope, 0, [a, b, c], [{ fromId: a, toId: c, weight: 0.6 }]);

    // A re-clustered pool is re-derived, not added to: a pair that is no longer
    // related must stop being an edge.
    expect(await neighbours(asCtx(ctx), scope, a)).toEqual([{ nodeId: c, level: 0, weight: 0.6 }]);
    expect(await neighbours(asCtx(ctx), scope, b)).toEqual([]);
  });

  it("leaves other generations alone when one is rewritten", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const b = await aNode(ctx, scope, { centroid: [0, 1] });

    await writeEdges(asCtx(ctx), scope, 0, [a, b], [{ fromId: a, toId: b, weight: 0.4 }]);
    await writeEdges(asCtx(ctx), scope, 2, [a, b], []);

    expect(await neighbours(asCtx(ctx), scope, a)).toEqual([{ nodeId: b, level: 0, weight: 0.4 }]);
  });

  it("stores a full-dimensional dot product, never the projected one", async () => {
    const { ctx, scope } = await asking();
    const vectors = separatedGroups({ groups: 6, per: 5, width: PCA_DIMS + 32 });
    const ids = [];
    for (const centroid of vectors) ids.push(await aNode(ctx, scope, { centroid }));

    const pool: ClusterArtifact[] = ids.map((id, index) => ({
      id,
      level: 0,
      centroid: vectors[index],
      windows: []
    }));
    // The approximate path, which is the only one that has a projection to get
    // this wrong with.
    const { edges } = levelOf(pool, approximateRelation(vectors));
    await writeEdges(asCtx(ctx), scope, 0, ids, edges);

    // Recomputed here rather than imported: the claim is about the arithmetic
    // that reached the row, and borrowing the implementation's own would not
    // test it. The projection selects candidates and never scores them.
    const full = (a: readonly number[], b: readonly number[]) => {
      let total = 0;
      for (let i = 0; i < a.length; i++) total += a[i] * b[i];
      return total;
    };

    const stored = edgeRows(ctx);
    expect(stored.length).toBeGreaterThan(0);
    for (const edge of stored) {
      const from = vectors[ids.indexOf(edge.fromId as (typeof ids)[number])];
      const to = vectors[ids.indexOf(edge.toId as (typeof ids)[number])];
      expect(edge.weight).toBeCloseTo(full(from, to), 12);
    }
  });
});

describe("neighbours", () => {
  it("answers strongest first", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const near = await aNode(ctx, scope, { centroid: [0, 1] });
    const far = await aNode(ctx, scope, { centroid: [0, 0, 1] });

    await writeEdges(
      asCtx(ctx),
      scope,
      0,
      [a, near, far],
      [
        { fromId: a, toId: far, weight: 0.4 },
        { fromId: a, toId: near, weight: 0.9 }
      ]
    );

    expect((await neighbours(asCtx(ctx), scope, a)).map((n) => n.nodeId)).toEqual([near, far]);
  });

  it("reports no neighbour for a node in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const a = await aNode(ctx, elsewhere, { centroid: [1, 0] });
    const b = await aNode(ctx, elsewhere, { centroid: [0, 1] });
    await writeEdges(asCtx(ctx), elsewhere, 0, [a, b], [{ fromId: a, toId: b, weight: 0.9 }]);

    // Not "forbidden" — an edge that is not this project's simply is not there.
    expect(await neighbours(asCtx(ctx), scope, a)).toEqual([]);
  });
});

describe("dropEdges", () => {
  it("takes a node's edges from either column and every generation", async () => {
    const { ctx, scope } = await asking();
    const a = await aNode(ctx, scope, { centroid: [1, 0] });
    const b = await aNode(ctx, scope, { centroid: [0, 1] });
    const c = await aNode(ctx, scope, { centroid: [0, 0, 1] });

    await writeEdges(
      asCtx(ctx),
      scope,
      0,
      [a, b, c],
      [
        { fromId: a, toId: b, weight: 0.8 },
        { fromId: b, toId: c, weight: 0.7 }
      ]
    );
    await writeEdges(asCtx(ctx), scope, 1, [a, b], [{ fromId: a, toId: b, weight: 0.6 }]);

    await dropEdges(asCtx(ctx), scope, b);

    // A deleted node's edges are claims about a node that no longer exists, and
    // a neighbour query has no way to notice that on its own.
    expect(await neighbours(asCtx(ctx), scope, a)).toEqual([]);
    expect(await neighbours(asCtx(ctx), scope, c)).toEqual([]);
  });
});

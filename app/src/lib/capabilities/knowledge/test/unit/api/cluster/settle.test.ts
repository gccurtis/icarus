import { describe, expect, it } from "vitest";
import type { Doc, Id } from "$convex/_generated/dataModel";
import { needsRebuild, settle } from "$knowledge/api/cluster/settle";
import { centroidOf } from "$knowledge/api/cluster/similarity";
import { neighbours, writeEdges } from "$knowledge/api/shared/edges";
import { aNode, asCtx, asking, latticeNodes, tilted } from "$knowledge/test/fixture";

const RADIANS = Math.PI / 180;
const DIMENSIONS = 10;
const TIER = "document:documents:1";

/** A unit vector `degrees` off axis `n`, leaning on an axis nothing else uses. */
const around = (n: number, degrees: number): number[] => {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  vector[n] = Math.cos(degrees * RADIANS);
  vector[n + 5] = Math.sin(degrees * RADIANS);
  return vector;
};

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];
type Scope = Awaited<ReturnType<typeof asking>>["scope"];

/**
 * Five corpus clusters of two members each, on five directions that share
 * nothing — so nothing clusters further and every move a test makes is the only
 * thing that moved.
 */
const aCorpusTier = async (ctx: Ctx, scope: Scope, spread = 10) => {
  const clusters = [];
  for (let n = 0; n < 5; n++) {
    const vectors = [around(n, spread), around(n, -spread)];
    const members = [];
    for (const centroid of vectors) {
      members.push(await aNode(ctx, scope, { centroid, tierSourceId: TIER, clustered: true }));
    }
    const id = await aNode(ctx, scope, {
      centroid: centroidOf(vectors),
      level: 1,
      members,
      cohesion: Math.cos(2 * spread * RADIANS),
      staleAt: 1
    });
    for (const member of members) await ctx.db.patch(member, { parentId: id });
    clusters.push({ id, members });
  }
  return clusters;
};

const read = async (ctx: Ctx, id: Id<"latticeNodes">) =>
  (await ctx.db.get(id)) as unknown as Doc<"latticeNodes"> | null;

describe("needsRebuild", () => {
  it("keeps a small, shallow change as a repair", () => {
    expect(needsRebuild({ fraction: 0.2, drift: 0.01 })).toBe(false);
  });

  it("rebuilds once too much of the tier is touched to be worth patching", () => {
    expect(needsRebuild({ fraction: 0.4, drift: 0 })).toBe(true);
  });

  it("rebuilds on drift alone, however little of the tier moved", () => {
    // One member replaced by something very different invalidates a centroid
    // entirely, and a fraction-only rule would happily keep it.
    expect(needsRebuild({ fraction: 0.01, drift: 0.06 })).toBe(true);
  });
});

describe("settle", () => {
  it("patches a cluster whose centroid barely moved, keeping its identity", async () => {
    const { ctx, scope } = await asking();
    const clusters = await aCorpusTier(ctx, scope);
    await ctx.db.patch(clusters[0].members[0], { centroid: around(0, 11) });

    const result = await settle(asCtx(ctx), scope, undefined);

    const repaired = await read(ctx, clusters[0].id);
    expect(result.rebuilt).toBe(false);
    expect(repaired?.members).toEqual(clusters[0].members);
    expect(repaired?.centroid).toEqual(centroidOf([around(0, 11), around(0, -10)]));
    // Repair brings it up to date, so the staleness that provoked it is over.
    expect(repaired?.staleAt).toBeUndefined();
    expect((await read(ctx, clusters[1].id))?.staleAt).toBe(1);
  });

  it("rebuilds when one member moved far, even though almost nothing was touched", async () => {
    const { ctx, scope } = await asking();
    const clusters = await aCorpusTier(ctx, scope);
    await ctx.db.patch(clusters[0].members[0], { centroid: around(0, 80) });

    const result = await settle(asCtx(ctx), scope, undefined);

    // One cluster in five is inside `repairMaxFraction`. The drift is not, and
    // the drift is what says the centroid no longer means anything — re-derived,
    // that pair is not a cluster at all, and its members go back on the frontier.
    expect(result.rebuilt).toBe(true);
    expect(await read(ctx, clusters[0].id)).toBeNull();
    for (const member of clusters[0].members) expect((await read(ctx, member))?.clustered).toBe(false);
    expect((await read(ctx, clusters[1].id))?._id).toBe(clusters[1].id);
  });

  it("keeps the rows of an unchanged grouping when it rebuilds", async () => {
    const { ctx, scope } = await asking();
    const clusters = await aCorpusTier(ctx, scope);
    await ctx.db.patch(clusters[0].members[0], { centroid: around(0, 11) });
    await ctx.db.patch(clusters[1].members[0], { centroid: around(1, 11) });

    const result = await settle(asCtx(ctx), scope, undefined);

    // Two in five is past `repairMaxFraction`, so the grouping is re-derived
    // from scratch — and a cluster *is* its sorted members, so reaching the same
    // grouping recognizes the same clusters instead of writing five new rows.
    expect(result.rebuilt).toBe(true);
    expect(result.created).toBe(0);
    expect(latticeNodes(ctx, scope).filter((node) => node.level === 1).map((node) => node._id)).toEqual(
      clusters.map((cluster) => cluster.id)
    );
    expect((await read(ctx, clusters[0].id))?.centroid).toEqual(
      centroidOf([around(0, 11), around(0, -10)])
    );
  });

  it("dissolves a cluster left with one member and puts it back on the frontier", async () => {
    const { ctx, scope } = await asking();
    // A twentieth of a degree apart: losing one barely moves the centroid, so
    // this is a repair — and a cluster of one is not a cluster.
    const clusters = await aCorpusTier(ctx, scope, 0.2);
    await ctx.db.delete(clusters[0].members[1]);

    const result = await settle(asCtx(ctx), scope, undefined);

    expect(result.dissolved).toBe(1);
    expect(await read(ctx, clusters[0].id)).toBeNull();
    const freed = await read(ctx, clusters[0].members[0]);
    expect(freed?.clustered).toBe(false);
    expect(freed?.parentId).toBeUndefined();
    expect(await read(ctx, clusters[1].id)).not.toBeNull();
  });

  it("takes a dissolved cluster's edges with it, at every generation", async () => {
    const { ctx, scope } = await asking();
    const clusters = await aCorpusTier(ctx, scope, 0.2);
    // At level 2, which is a generation this pass does not reach — a pass
    // rewrites its own network and knows nothing of the ones above it, so the
    // dissolve is what has to take the rest.
    await writeEdges(
      asCtx(ctx),
      scope,
      2,
      [clusters[0].id, clusters[1].id],
      [{ fromId: clusters[0].id, toId: clusters[1].id, weight: 0.4 }]
    );
    await ctx.db.delete(clusters[0].members[1]);

    await settle(asCtx(ctx), scope, undefined);

    // An edge outliving its endpoint hands back an id that reads as a node
    // until someone loads it, and a neighbour query cannot notice on its own.
    expect(await neighbours(asCtx(ctx), scope, clusters[1].id, 2)).toEqual([]);
  });

  it("clusters what is on the tier's frontier when nothing was damaged at all", async () => {
    const { ctx, scope } = await asking();
    for (const degrees of [0, 5]) {
      await aNode(ctx, scope, { centroid: tilted(0, 1, degrees), tierSourceId: TIER });
    }

    const result = await settle(asCtx(ctx), scope, TIER);

    expect(result.rebuilt).toBe(false);
    expect(result.created).toBe(1);
    expect(latticeNodes(ctx, scope).filter((node) => node.level === 1)).toHaveLength(1);
  });
});

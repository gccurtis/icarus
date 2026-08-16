import { describe, expect, it } from "vitest";
import type { Doc, Id } from "$convex/_generated/dataModel";
import { grow } from "$knowledge/api/cluster/grow";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { aNode, asCtx, asking, bridgedGroups, latticeNodes, tilted } from "$knowledge/test/fixture";

const notes: LatticeSource = { kind: "document", id: "documents:1" as Id<"documents"> };
const TIER = "document:documents:1";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

const poolOf = async (ctx: Ctx, ids: Id<"latticeNodes">[]) =>
  (await Promise.all(ids.map((id) => ctx.db.get(id)))) as unknown as Doc<"latticeNodes">[];

describe("grow", () => {
  it("writes a node per clique with what it measured, and stamps the tier on it", async () => {
    const { ctx, scope } = await asking();
    const { a1, a2, b1, b2, bridge, loner, drifter } = bridgedGroups();
    const ids = [];
    for (const centroid of [a1, a2, b1, b2, bridge, loner, drifter]) {
      ids.push(
        await aNode(ctx, scope, {
          centroid,
          tierSourceId: TIER,
          windows: [{ source: notes, start: 0, end: 10, density: 1 }]
        })
      );
    }

    await grow(asCtx(ctx), scope, TIER, await poolOf(ctx, ids));

    const clusters = latticeNodes(ctx, scope).filter((node) => node.level === 1);
    expect(clusters).toHaveLength(2);
    for (const cluster of clusters) {
      expect(cluster.tierSourceId).toBe(TIER);
      expect(cluster.count).toBe(3);
      expect(cluster.members).toHaveLength(3);
      expect(cluster.cohesion).toBeCloseTo(Math.cos((10 * Math.PI) / 180) / Math.SQRT2, 12);
      expect(cluster.text).toBeUndefined();
    }
  });

  it("leaves the tier off a corpus node, because it spans sources", async () => {
    const { ctx, scope } = await asking();
    const ids = [
      await aNode(ctx, scope, { centroid: tilted(0, 1, 0), tierSourceId: TIER }),
      await aNode(ctx, scope, { centroid: tilted(0, 1, 5), tierSourceId: "document:documents:2" })
    ];

    await grow(asCtx(ctx), scope, undefined, await poolOf(ctx, ids));

    const [cluster] = latticeNodes(ctx, scope).filter((node) => node.level === 1);
    expect(cluster.tierSourceId).toBeUndefined();
  });

  it("marks each member clustered, and leaves a shared member with its first parent", async () => {
    const { ctx, scope } = await asking();
    const { a1, a2, b1, b2, bridge } = bridgedGroups();
    const ids = [];
    for (const centroid of [a1, a2, b1, b2, bridge]) {
      ids.push(await aNode(ctx, scope, { centroid, tierSourceId: TIER }));
    }
    const bridgeId = ids[4];

    await grow(asCtx(ctx), scope, TIER, await poolOf(ctx, ids));

    const clusters = latticeNodes(ctx, scope).filter((node) => node.level === 1);
    const holders = clusters.filter((cluster) => cluster.members?.includes(bridgeId));
    const stored = (await ctx.db.get(bridgeId)) as unknown as Doc<"latticeNodes">;

    // Two cliques hold it and only one field can name a parent, so `members` is
    // the truth about containment and `parentId` is the walk upwards.
    expect(holders).toHaveLength(2);
    expect(stored.clustered).toBe(true);
    expect(stored.parentId).toBe(holders[0]._id);
  });

  it("carries a level's orphans into the next level rather than dropping them", async () => {
    const { ctx, scope } = await asking();
    const ids = [];
    for (const degrees of [0, 10, 40]) {
      ids.push(await aNode(ctx, scope, { centroid: tilted(0, 1, degrees), tierSourceId: TIER }));
    }

    await grow(asCtx(ctx), scope, TIER, await poolOf(ctx, ids));

    // The 40° artifact is too far to join at level 0, where the threshold is set
    // by a very tight pair — and close enough to the cluster they became. An
    // artifact passed over at one level is not passed over for good.
    const [second] = latticeNodes(ctx, scope).filter((node) => node.level === 2);
    expect(second.members).toContain(ids[2]);
    expect(second.count).toBe(2);
  });

  it("stops when nothing more clusters, leaving the roots on the frontier", async () => {
    const { ctx, scope } = await asking();
    const ids = [];
    for (const degrees of [0, 10, 40]) {
      ids.push(await aNode(ctx, scope, { centroid: tilted(0, 1, degrees), tierSourceId: TIER }));
    }

    await grow(asCtx(ctx), scope, TIER, await poolOf(ctx, ids));

    // The unclustered set is retrieval's entry point, so a pass that left the
    // top of its own hierarchy clustered would hide it from every query.
    const unclustered = latticeNodes(ctx, scope).filter((node) => !node.clustered);
    expect(unclustered.map((node) => node.level)).toEqual([2]);
  });

  it("clusters nothing when no pair is close enough", async () => {
    const { ctx, scope } = await asking();
    const ids = [
      await aNode(ctx, scope, { centroid: tilted(0, 1, 0), tierSourceId: TIER }),
      await aNode(ctx, scope, { centroid: tilted(0, 1, 85), tierSourceId: TIER })
    ];

    const grown = await grow(asCtx(ctx), scope, TIER, await poolOf(ctx, ids));

    expect(grown.written).toEqual([]);
    expect(latticeNodes(ctx, scope).every((node) => !node.clustered)).toBe(true);
  });
});

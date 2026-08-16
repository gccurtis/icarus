import { describe, expect, it } from "vitest";
import type { Scope } from "$access/types/access";
import { cluster } from "$knowledge/api/cluster/cluster";
import { centroidOf } from "$knowledge/api/cluster/similarity";
import { ensureVersion, readVersion } from "$knowledge/api/shared/version";
import { sourceKey, type LatticeSource } from "$knowledge/types/lattice-source";
import {
  aDocument,
  aNode,
  asCtx,
  asking,
  fakeEmbedder,
  latticeNodes,
  tilted
} from "$knowledge/test/fixture";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

/** One source's windows, each a level-0 node facing the direction the test chose. */
const windowsOf = async (ctx: Ctx, scope: Scope, source: LatticeSource, degrees: number[]) => {
  for (const [index, angle] of degrees.entries()) {
    await aNode(ctx, scope, {
      centroid: tilted(0, 1, angle),
      tierSourceId: sourceKey(source),
      windows: [{ source, start: index * 100, end: index * 100 + 100, density: 1 }]
    });
  }
};

/** A cluster several passes old, standing over windows of a source of its own. */
const aDeepNode = async (ctx: Ctx, scope: Scope, degrees: number) => {
  const source = await aDocument(ctx, scope, "Earlier");
  const members = [];
  for (const angle of [degrees - 1, degrees + 1]) {
    members.push(
      await aNode(ctx, scope, {
        centroid: tilted(0, 1, angle),
        tierSourceId: sourceKey(source),
        clustered: true
      })
    );
  }
  const id = await aNode(ctx, scope, {
    centroid: centroidOf([tilted(0, 1, degrees - 1), tilted(0, 1, degrees + 1)]),
    level: 3,
    members
  });
  for (const member of members) await ctx.db.patch(member, { parentId: id });
  return id;
};

/** Two sources whose own clusters are close enough to meet above them. */
const twoSources = async (ctx: Ctx, scope: Scope) => {
  const notes = await aDocument(ctx, scope, "Notes");
  const memo = await aDocument(ctx, scope, "Memo");
  await windowsOf(ctx, scope, notes, [0, 10, 90]);
  await windowsOf(ctx, scope, memo, [5, 15]);
  await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);
  return { notes, memo };
};

describe("cluster", () => {
  it("builds each source's own forest, then the corpus tier over their frontiers", async () => {
    const { ctx, scope } = await asking();
    const { notes, memo } = await twoSources(ctx, scope);

    await cluster(asCtx(ctx), scope);

    const nodes = latticeNodes(ctx, scope);
    const sourceTier = nodes.filter((node) => node.level > 0 && node.tierSourceId !== undefined);
    const [corpus] = nodes.filter((node) => node.level > 0 && node.tierSourceId === undefined);

    // A source-tier node clusters one source's windows and says which; a corpus
    // node spans several, which is why it names none.
    expect(sourceTier.map((node) => node.tierSourceId).sort()).toEqual(
      [sourceKey(notes), sourceKey(memo)].sort()
    );
    expect(corpus.members).toEqual(sourceTier.map((node) => node._id));
    expect(new Set(corpus.windows.map((window) => window.source.id)).size).toBe(2);
  });

  it("leaves a window with no strong neighbour on the frontier, at any level", async () => {
    const { ctx, scope } = await asking();
    await twoSources(ctx, scope);

    await cluster(asCtx(ctx), scope);

    // Forcing it into the nearest cluster would invent a relationship the
    // weights did not support, and the unclustered set is what descent enters
    // from — an orphan is a root, not a loose end.
    const frontier = latticeNodes(ctx, scope).filter((node) => !node.clustered);
    expect(frontier.filter((node) => node.level === 0)).toHaveLength(1);
    expect(frontier.filter((node) => node.level > 0)).toHaveLength(1);
  });

  it("clusters an unclustered node of any level, not only what the last pass produced", async () => {
    const { ctx, scope } = await asking();
    const source = await aDocument(ctx, scope);
    const window = await aNode(ctx, scope, {
      centroid: tilted(0, 1, 0),
      tierSourceId: sourceKey(source),
      windows: [{ source, start: 0, end: 100, density: 1 }]
    });
    const summary = await aDeepNode(ctx, scope, 5);
    await ensureVersion(asCtx(ctx), scope, fakeEmbedder().embedding);

    await cluster(asCtx(ctx), scope);

    // A level-3 cluster absorbing a level-0 window passed over long ago is the
    // property: the frontier is every unclustered node, not the newest level.
    const [joined] = latticeNodes(ctx, scope).filter((node) => node.level === 4);
    expect(joined.members?.slice().sort()).toEqual([window, summary].sort());
  });

  it("changes nothing on a second pass over an unchanged lattice", async () => {
    const { ctx, scope } = await asking();
    await twoSources(ctx, scope);
    await cluster(asCtx(ctx), scope);
    const before = latticeNodes(ctx, scope).map((node) => node._id);

    const again = await cluster(asCtx(ctx), scope);

    // Node ids hash their members, so an unchanged grouping is recognized rather
    // than churned — and the frontier a pass leaves behind is a frontier the
    // next pass agrees with.
    expect(again.created).toBe(0);
    expect(again.rebuilt).toBe(0);
    expect(latticeNodes(ctx, scope).map((node) => node._id)).toEqual(before);
  });

  it("records what it left at every level", async () => {
    const { ctx, scope } = await asking();
    await twoSources(ctx, scope);

    const pass = await cluster(asCtx(ctx), scope);
    const version = await readVersion(asCtx(ctx), scope);

    expect(version?.nodesByLevel).toEqual([5, 2, 1]);
    expect(version?.levelCount).toBe(3);
    expect(version?.nodeCount).toBe(8);
    expect(version?.version).toBe(2);
    expect(pass.levelCount).toBe(3);
  });

  it("counts how far up it reached, per level, rather than listing what it touched", async () => {
    const { ctx, scope } = await asking();
    await twoSources(ctx, scope);

    const pass = await cluster(asCtx(ctx), scope);

    // Two source clusters and the corpus node above them. The windows underneath
    // were not rewritten, so the count at level 0 is zero — which is exactly the
    // shape of the question: how far up did this reach.
    expect(pass.reclustered).toEqual([0, 2, 1]);
  });

  it("reports nothing reclustered when the pass changed nothing", async () => {
    const { ctx, scope } = await asking();
    await twoSources(ctx, scope);
    await cluster(asCtx(ctx), scope);

    const again = await cluster(asCtx(ctx), scope);

    expect(again.reclustered).toEqual([]);
  });

  it("does nothing at all for a project that has never been ingested", async () => {
    const { ctx, scope } = await asking();

    const pass = await cluster(asCtx(ctx), scope);

    expect(pass).toEqual({
      tiers: 0,
      created: 0,
      dissolved: 0,
      rebuilt: 0,
      levelCount: 0,
      reclustered: []
    });
    expect(latticeNodes(ctx, scope)).toEqual([]);
  });

  it("clusters the caller's project and no other", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await twoSources(ctx, scope);
    await twoSources(ctx, elsewhere);

    await cluster(asCtx(ctx), scope);

    // The same geometry in another project is another project's lattice, and a
    // read that forgot the predicate would have clustered across both.
    expect(latticeNodes(ctx, elsewhere).every((node) => !node.clustered)).toBe(true);
    expect(latticeNodes(ctx, elsewhere)).toHaveLength(5);
  });
});

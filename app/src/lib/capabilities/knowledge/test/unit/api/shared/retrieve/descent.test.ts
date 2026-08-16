import { describe, expect, it, vi } from "vitest";
import type { Scope } from "$access/types/access";
import { descend, MAX_EXPANSIONS } from "$knowledge/api/shared/retrieve/descent";
import { frontier } from "$knowledge/api/shared/retrieve/frontier";
import { aCorpus, aDocument, aNode, asCtx, asking, leaning } from "$knowledge/test/fixture";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

/** Descent from the project's own frontier, counting what it had to load. */
const descentOf = async (ctx: Ctx, scope: Scope, query: number[]) => {
  const entered = await frontier(asCtx(ctx), scope);
  const spy = vi.spyOn(ctx.db, "get");
  const reached = await descend(asCtx(ctx), scope, query, entered);
  const loads = spy.mock.calls.length;
  spy.mockRestore();
  return { reached, loads };
};

describe("descend", () => {
  it("reaches the windows under the cluster the query is aimed at", async () => {
    const { ctx, scope } = await asking();
    const { width } = await aCorpus(ctx, scope, { groups: 3 });

    const { reached } = await descentOf(ctx, scope, leaning(width, 1, 0));

    expect(reached.size).toBe(4);
    for (const score of reached.values()) expect(score).toBeGreaterThan(0.98);
  });

  it("never opens a branch scoring below the threshold", async () => {
    const { ctx, scope } = await asking();
    const { width } = await aCorpus(ctx, scope, { groups: 3 });

    const { reached, loads } = await descentOf(ctx, scope, leaning(width, 1, 0));

    // A cluster's centroid approximates its members, so a cluster scoring poorly
    // means everything beneath it scores poorly. One branch is opened: the
    // cluster and the four windows under it.
    expect(loads).toBe(5);
    expect(reached.size).toBe(4);
  });

  it("costs the same on a corpus ten times larger", async () => {
    const small = await asking();
    const large = await asking();
    const { width: narrow } = await aCorpus(small.ctx, small.scope, { groups: 2 });
    const { width: wide } = await aCorpus(large.ctx, large.scope, { groups: 20 });

    const near = await descentOf(small.ctx, small.scope, leaning(narrow, 0, 0));
    const far = await descentOf(large.ctx, large.scope, leaning(wide, 0, 0));

    // The whole reason the hierarchy exists: a corpus ten times larger has more
    // levels, and each level is one more hop rather than one more scan.
    expect(far.loads).toBe(near.loads);
    expect(far.reached.size).toBe(near.reached.size);
  });

  it("returns nothing at all for a query orthogonal to the corpus", async () => {
    const { ctx, scope } = await asking();
    const { width } = await aCorpus(ctx, scope, { groups: 3 });

    const { reached, loads } = await descentOf(ctx, scope, leaning(width, width - 1, 0));

    // A query with no good answer says so. There is no fallback scan: nothing
    // was loaded, so nothing could have been returned for lack of anything
    // better.
    expect(reached.size).toBe(0);
    expect(loads).toBe(0);
  });

  it("stops at the expansion ceiling however much stands above the threshold", async () => {
    const { ctx, scope } = await asking();
    const source = await aDocument(ctx, scope, "Everything");
    for (let index = 0; index < MAX_EXPANSIONS + 40; index++) {
      const member = await aNode(ctx, scope, {
        centroid: leaning(2, 0, 0),
        clustered: true,
        windows: [{ source, start: index, end: index + 1, density: 1 }],
        text: "x"
      });
      const cluster = await aNode(ctx, scope, {
        level: 1,
        centroid: leaning(2, 0, 0),
        members: [member]
      });
      await ctx.db.patch(member, { parentId: cluster });
    }

    const { loads } = await descentOf(ctx, scope, leaning(2, 0, 0));

    // The hard ceiling, so a pathological graph cannot run away: one load for
    // each expanded cluster and one for the window it holds.
    expect(loads).toBe(MAX_EXPANSIONS * 2);
  });

  it("records a window two overlapping cliques hold exactly once", async () => {
    const { ctx, scope } = await asking();
    const source = await aDocument(ctx, scope, "Shared");
    const windows = [];
    for (let index = 0; index < 3; index++) {
      windows.push(
        await aNode(ctx, scope, {
          centroid: leaning(2, 0, index * 2),
          clustered: true,
          windows: [{ source, start: index * 100, end: index * 100 + 100, density: 1 }],
          text: "x"
        })
      );
    }
    for (const members of [windows.slice(0, 2), windows.slice(1)]) {
      await aNode(ctx, scope, { level: 1, centroid: leaning(2, 0, 2), members });
    }

    const { reached } = await descentOf(ctx, scope, leaning(2, 0, 2));

    // Cliques overlap by design, so the middle window is under both. It is one
    // window and one score, not two.
    expect(reached.size).toBe(3);
  });
});

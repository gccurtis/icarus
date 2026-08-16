import { describe, expect, it } from "vitest";
import { CONSOLIDATE_AFTER, consolidate } from "$revisions/api/consolidate/consolidate";
import {
  RESOURCE,
  asCtx,
  asking,
  landed,
  leaderAt,
  refusalFrom,
  setAt,
  setsStored,
  snapshotsStored
} from "$revisions/test/fixture";
import type { fakeCtx } from "$shared/test/fake-ctx";

/**
 * Each set places a row after the one the set below it created, so folding them
 * in any order but revision order throws rather than storing a body nobody wrote.
 */
const chain = async (ctx: ReturnType<typeof fakeCtx>, projectId: string, count: number) => {
  for (let revision = 1; revision <= count; revision += 1) {
    await landed(ctx, projectId, revision, [
      {
        op: "insert",
        target: "row",
        path: "rows",
        after: revision === 1 ? null : `#r${revision - 1}`,
        values: [{ id: `r${revision}` }]
      }
    ]);
  }
};

const tiers = (ctx: ReturnType<typeof fakeCtx>) => setsStored(ctx).map((set) => set.tier);

describe("consolidate", () => {
  it("folds the recent sets into the leader and re-tiers them", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, { rows: [] });
    await chain(ctx, projectId, CONSOLIDATE_AFTER + 1);

    expect(await consolidate(asCtx(ctx), scope, RESOURCE)).toEqual({
      revision: CONSOLIDATE_AFTER + 1,
      folded: CONSOLIDATE_AFTER + 1
    });
    const leader = snapshotsStored(ctx)[0];
    expect(leader).toMatchObject({ revision: CONSOLIDATE_AFTER + 1, role: "leader" });
    // The chain's order, so a fold in any other order would have thrown.
    expect((leader.body as { rows: unknown[] }).rows.at(-1)).toEqual({
      id: `r${CONSOLIDATE_AFTER + 1}`
    });
    expect(new Set(tiers(ctx))).toEqual(new Set(["historical"]));
  });

  it("keeps the folded sets, because rebasing still reads them", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, { rows: [] });
    await chain(ctx, projectId, CONSOLIDATE_AFTER + 1);

    await consolidate(asCtx(ctx), scope, RESOURCE);

    // Re-tiering is a flag flip, not a copy between tables and not a delete —
    // `consolidateAfter` sits below `rebaseWindow` so these are still in range.
    expect(setsStored(ctx)).toHaveLength(CONSOLIDATE_AFTER + 1);
    expect(setAt(ctx, 1)).toMatchObject({ ops: [{ op: "insert" }] });
  });

  it("waits until more than a window has accumulated", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, { rows: [] });
    await chain(ctx, projectId, CONSOLIDATE_AFTER);

    expect(await consolidate(asCtx(ctx), scope, RESOURCE)).toEqual({ revision: 0, folded: 0 });
    expect(snapshotsStored(ctx)[0]).toMatchObject({ revision: 0, body: { rows: [] } });
    expect(new Set(tiers(ctx))).toEqual(new Set(["recent"]));
  });

  it("does not touch the resource row", async () => {
    const { ctx, scope, projectId } = await asking();
    const documentId = await ctx.db.insert("documents", {
      projectId,
      title: "Q3 plan",
      updatedAt: 1
    });
    await leaderAt(ctx, projectId, 0, { rows: [] });
    await chain(ctx, projectId, CONSOLIDATE_AFTER + 1);

    await consolidate(asCtx(ctx), scope, RESOURCE);

    expect(ctx.rows.get(documentId)).toMatchObject({ title: "Q3 plan", updatedAt: 1 });
  });

  it("reports not found for a resource in another project", async () => {
    const { ctx, scope, projectId } = await asking();
    const theirs = await ctx.db.insert("projects", { name: "Theirs", revision: 1, updatedAt: 1 });
    await leaderAt(ctx, theirs, 0, { rows: [] });
    await chain(ctx, projectId, CONSOLIDATE_AFTER + 1);

    expect(await refusalFrom(consolidate(asCtx(ctx), scope, RESOURCE))).toMatchObject({
      code: "not-found"
    });
    expect(new Set(tiers(ctx))).toEqual(new Set(["recent"]));
  });
});

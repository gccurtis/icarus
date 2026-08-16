import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { markStale } from "$knowledge/api/shared/mark-stale";
import { asCtx, asking } from "$knowledge/test/fixture";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

const AT = 1_800_000_000_000;

const node = async (
  ctx: Ctx,
  projectId: string,
  level: number,
  parentId?: string
): Promise<Id<"latticeNodes">> =>
  (await ctx.db.insert("latticeNodes", {
    projectId,
    level,
    clustered: parentId !== undefined,
    windows: [],
    centroid: [1, 0],
    parentId,
    updatedAt: 0
  })) as Id<"latticeNodes">;

const staleAtOf = async (ctx: Ctx, id: string) =>
  ((await ctx.db.get(id)) as { staleAt?: number } | null)?.staleAt;

describe("markStale", () => {
  it("cascades upward, because a cluster built from changed text is stale too", async () => {
    const { ctx, scope } = await asking();
    const top = await node(ctx, scope.projectId, 2);
    const middle = await node(ctx, scope.projectId, 1, top);
    const leaf = await node(ctx, scope.projectId, 0, middle);

    await markStale(asCtx(ctx), scope, [leaf], AT);

    // A cluster built from a passage that no longer exists is stale whether or
    // not its own centroid moved.
    expect(await staleAtOf(ctx, leaf)).toBe(AT);
    expect(await staleAtOf(ctx, middle)).toBe(AT);
    expect(await staleAtOf(ctx, top)).toBe(AT);
  });

  it("leaves a sibling branch alone", async () => {
    const { ctx, scope } = await asking();
    const top = await node(ctx, scope.projectId, 1);
    const changed = await node(ctx, scope.projectId, 0, top);
    const untouched = await node(ctx, scope.projectId, 0);

    await markStale(asCtx(ctx), scope, [changed], AT);

    expect(await staleAtOf(ctx, untouched)).toBeUndefined();
  });

  it("reports how many it newly marked, and marks none of them twice", async () => {
    const { ctx, scope } = await asking();
    const top = await node(ctx, scope.projectId, 1);
    const first = await node(ctx, scope.projectId, 0, top);
    const second = await node(ctx, scope.projectId, 0, top);

    // Two leaves sharing one parent: three nodes, not four.
    expect(await markStale(asCtx(ctx), scope, [first, second], AT)).toBe(3);
    expect(await markStale(asCtx(ctx), scope, [first, second], AT + 1)).toBe(0);
    expect(await staleAtOf(ctx, top)).toBe(AT);
  });

  it("stops at a node in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await node(ctx, elsewhere.projectId, 1);
    const mine = await node(ctx, scope.projectId, 0, theirs);

    expect(await markStale(asCtx(ctx), scope, [mine], AT)).toBe(1);
    expect(await staleAtOf(ctx, theirs)).toBeUndefined();
  });
});

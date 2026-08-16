import { describe, expect, it } from "vitest";
import { head } from "$revisions/api/shared/head";
import {
  asCtx,
  asking,
  bodyWithBlock,
  landed,
  leaderAt,
  RESOURCE,
  scopeOf
} from "$revisions/test/fixture";

/**
 * Where a resource stands, in at most two rows. Anything that reads the body to
 * learn a number would pass every assertion below except the last one.
 */
describe("head", () => {
  it("is the last accepted set's revision", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, bodyWithBlock());
    await landed(ctx, projectId, 1, []);
    await landed(ctx, projectId, 2, []);

    expect(await head(asCtx(ctx), scope, RESOURCE)).toBe(2);
  });

  it("falls back to the leader once consolidation has re-tiered every set", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 7, [], { tier: "historical" });

    expect(await head(asCtx(ctx), scope, RESOURCE)).toBe(7);
  });

  it("is nothing at all for a resource in another project", async () => {
    const { ctx, scope, userId } = await asking();
    await leaderAt(ctx, "projects:9", 4, bodyWithBlock());
    await landed(ctx, "projects:9", 5, []);

    // Both indexes lead with `projectId`, so somebody else's resource is
    // indistinguishable from one that was never started — and the caller who
    // does hold it still sees it.
    expect(await head(asCtx(ctx), scope, RESOURCE)).toBeNull();
    expect(await head(asCtx(ctx), scopeOf("projects:9", userId), RESOURCE)).toBe(5);
  });

  it("is nothing at all for a resource that was never started", async () => {
    const { ctx, scope } = await asking();

    expect(await head(asCtx(ctx), scope, { ...RESOURCE, resourceId: "documents:404" })).toBeNull();
  });

  it("reads a revision rather than a body", async () => {
    const { ctx, scope, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, bodyWithBlock());
    await landed(ctx, projectId, 1, []);

    // A caller asking only for the revision must not pay for the deck behind it,
    // which is what lets staleness be computed over a list of outputs.
    expect(await head(asCtx(ctx), scope, RESOURCE)).toBe(1);
  });
});

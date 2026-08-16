import { describe, expect, it } from "vitest";
import { head } from "$revisions/api/shared/head";
import { asCtx, asking, bodyWithBlock, landed, leaderAt, RESOURCE } from "$revisions/test/fixture";

/**
 * Where a resource stands, in at most two rows. Anything that reads the body to
 * learn a number would pass every assertion below except the last one.
 */
describe("head", () => {
  it("is the last accepted set's revision", async () => {
    const { ctx, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, bodyWithBlock());
    await landed(ctx, projectId, 1, []);
    await landed(ctx, projectId, 2, []);

    expect(await head(asCtx(ctx), RESOURCE)).toMatchObject({ revision: 2, projectId });
  });

  it("falls back to the leader once consolidation has re-tiered every set", async () => {
    const { ctx, projectId } = await asking();
    await leaderAt(ctx, projectId, 7, bodyWithBlock());
    await landed(ctx, projectId, 7, [], { tier: "historical" });

    expect(await head(asCtx(ctx), RESOURCE)).toMatchObject({ revision: 7, projectId });
  });

  it("carries the project, because the change-set indexes are not scoped by the gate", async () => {
    const { ctx } = await asking();
    await leaderAt(ctx, "projects:9", 0, bodyWithBlock());

    // The pair leads every index here, so this row is the only thing that can
    // say whose the resource is.
    expect((await head(asCtx(ctx), RESOURCE))?.projectId).toBe("projects:9");
  });

  it("is nothing at all for a resource that was never started", async () => {
    const { ctx } = await asking();

    expect(await head(asCtx(ctx), { ...RESOURCE, resourceId: "documents:404" })).toBeNull();
  });

  it("reads two rows rather than a body", async () => {
    const { ctx, projectId } = await asking();
    await leaderAt(ctx, projectId, 0, bodyWithBlock());
    await landed(ctx, projectId, 1, []);

    // A caller asking only for the revision must not pay for the deck behind it,
    // which is what lets staleness be computed over a list of outputs.
    expect(Object.keys((await head(asCtx(ctx), RESOURCE)) ?? {}).sort()).toEqual([
      "projectId",
      "revision"
    ]);
  });
});

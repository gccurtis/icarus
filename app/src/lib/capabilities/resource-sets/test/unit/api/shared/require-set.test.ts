import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { requireSet } from "$resource-sets/api/shared/require-set";
import { aSet, asCtx, asking, refusalFrom } from "$resource-sets/test/fixture";

describe("requireSet", () => {
  it("returns the caller's own set", async () => {
    const { ctx, scope } = await asking();
    const id = await aSet(ctx, scope, "Everything", { op: "project" });

    expect(await requireSet(asCtx(ctx), scope, id as Id<"resourceSets">)).toMatchObject({
      name: "Everything",
      projectId: scope.projectId
    });
  });

  it("reports not found for a set in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await aSet(ctx, elsewhere, "Theirs", { op: "project" });

    // NOT "forbidden" — distinguishing them confirms the set exists to someone
    // with no right to know that.
    expect(
      await refusalFrom(requireSet(asCtx(ctx), scope, theirs as Id<"resourceSets">))
    ).toMatchObject({ code: "not-found" });
  });

  it("reports not found for a set that never existed", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(requireSet(asCtx(ctx), scope, "resourceSets:404" as Id<"resourceSets">))
    ).toMatchObject({ code: "not-found" });
  });
});

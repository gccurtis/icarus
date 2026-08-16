import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { requireAnchor } from "$research-threads/api/shared/require-anchor";
import { asCtx, refusalFrom, researching } from "$research-threads/test/fixture";

describe("requireAnchor", () => {
  it("passes an anchor the caller's project holds", async () => {
    const { ctx, scope, here } = await researching();

    await expect(
      requireAnchor(asCtx(ctx), scope, { questionId: here.questionId })
    ).resolves.toBeUndefined();
    await expect(
      requireAnchor(asCtx(ctx), scope, { hypothesisId: here.hypothesisId })
    ).resolves.toBeUndefined();
  });

  it("has nothing to prove for a discover thread", async () => {
    const { ctx, scope } = await researching();

    // Not a skipped check: `researchThreadAnchor` has already refused an anchor
    // the mode does not name, so an empty one is the mode itself.
    await expect(requireAnchor(asCtx(ctx), scope, {})).resolves.toBeUndefined();
  });

  it("reports not found for an anchor in another project", async () => {
    const { ctx, scope, there } = await researching();

    // Not "forbidden": distinguishing them confirms the question exists to
    // someone with no right to know that.
    expect(
      await refusalFrom(requireAnchor(asCtx(ctx), scope, { questionId: there.questionId }))
    ).toMatchObject({ code: "not-found" });
    expect(
      await refusalFrom(requireAnchor(asCtx(ctx), scope, { hypothesisId: there.hypothesisId }))
    ).toMatchObject({ code: "not-found" });
  });

  it("reports not found for an anchor that never existed", async () => {
    const { ctx, scope } = await researching();

    expect(
      await refusalFrom(
        requireAnchor(asCtx(ctx), scope, { questionId: "questions:404" as Id<"questions"> })
      )
    ).toMatchObject({ code: "not-found" });
  });
});

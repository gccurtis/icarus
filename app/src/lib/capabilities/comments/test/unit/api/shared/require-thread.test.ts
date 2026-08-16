import { describe, expect, it } from "vitest";
import { requireThread } from "$comments/api/shared/require-thread";
import { start } from "$comments/api/start/start";
import { asCtx, asking, documentOf, paragraph, refusalFrom, remark } from "$comments/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

const opened = async () => {
  const { ctx, scope, elsewhere } = await asking();
  const targetId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const id = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId },
    blocks: remark()
  });

  return { ctx, scope, elsewhere, id };
};

describe("requireThread", () => {
  it("returns the thread when it is the caller's", async () => {
    const { ctx, scope, id } = await opened();

    expect(await requireThread(asCtx(ctx), scope, id)).toMatchObject({
      _id: id,
      projectId: scope.projectId
    });
  });

  /**
   * Not found, never forbidden: telling them apart confirms the thread exists to
   * somebody with no right to know that.
   */
  it("reports not found for a thread in another project", async () => {
    const { ctx, elsewhere, id } = await opened();

    expect(await refusalFrom(requireThread(asCtx(ctx), elsewhere, id))).toMatchObject({
      code: "not-found"
    });
  });

  it("answers a thread that never existed the same way", async () => {
    const { ctx, scope } = await opened();

    expect(
      await refusalFrom(
        requireThread(asCtx(ctx), scope, "commentThreads:99" as Id<"commentThreads">)
      )
    ).toMatchObject({ code: "not-found" });
  });
});

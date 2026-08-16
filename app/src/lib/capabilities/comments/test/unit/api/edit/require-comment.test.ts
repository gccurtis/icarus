import { describe, expect, it } from "vitest";
import { requireComment } from "$comments/api/edit/require-comment";
import { start } from "$comments/api/start/start";
import { asCtx, asking, documentOf, paragraph, refusalFrom, remark } from "$comments/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

const opened = async () => {
  const { ctx, scope, elsewhere } = await asking();
  const targetId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const threadId = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId },
    blocks: remark()
  });
  const id = [...ctx.rows.entries()].find(([, row]) => row._table === "comments")![0];

  return { ctx, scope, elsewhere, threadId, id: id as Id<"comments"> };
};

describe("requireComment", () => {
  it("returns the comment when it is the caller's", async () => {
    const { ctx, scope, id } = await opened();

    expect(await requireComment(asCtx(ctx), scope, id)).toMatchObject({
      _id: id,
      projectId: scope.projectId
    });
  });

  /**
   * The reason a comment carries `projectId` at all: this decides access from the
   * comment's own column, so the thread above it is never read — and a query that
   * has to join upward to check access is a query that will eventually forget to.
   */
  it("refuses a comment in another project even when its thread is the caller's", async () => {
    const { ctx, scope, elsewhere, threadId } = await opened();
    const theirs = (await ctx.db.insert("comments", {
      projectId: elsewhere.projectId,
      threadId,
      blocks: remark("Not yours"),
      author: { kind: "system" }
    })) as Id<"comments">;

    expect(await refusalFrom(requireComment(asCtx(ctx), scope, theirs))).toMatchObject({
      code: "not-found"
    });
  });

  it("answers a comment that never existed the same way", async () => {
    const { ctx, scope } = await opened();

    expect(
      await refusalFrom(requireComment(asCtx(ctx), scope, "comments:99" as Id<"comments">))
    ).toMatchObject({ code: "not-found" });
  });
});

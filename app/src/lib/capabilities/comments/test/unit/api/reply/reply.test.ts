import { describe, expect, it } from "vitest";
import { reply } from "$comments/api/reply/reply";
import { start } from "$comments/api/start/start";
import { asCtx, asking, documentOf, paragraph, refusalFrom, remark } from "$comments/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

const opened = async () => {
  const { ctx, scope, userId, elsewhere } = await asking();
  const targetId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const threadId = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId },
    blocks: remark("Where is this from?")
  });

  return { ctx, scope, userId, elsewhere, threadId };
};

describe("reply", () => {
  it("hangs the remark off the thread, in the caller's project", async () => {
    const { ctx, scope, userId, threadId } = await opened();

    const id = await reply(asCtx(ctx), scope, threadId, remark("The Q3 scan"));

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      threadId,
      author: { kind: "user", userId }
    });
  });

  it("carries the mentions extracted beside the blocks", async () => {
    const { ctx, scope, threadId } = await opened();

    const id = await reply(asCtx(ctx), scope, threadId, remark("@Researcher?"), [
      { kind: "persona", personaId: "personas:1" as Id<"personas"> }
    ]);

    expect(ctx.rows.get(id)?.mentions).toEqual([{ kind: "persona", personaId: "personas:1" }]);
  });

  /** The thread moves when it is replied to, which is what a "recently active" list reads. */
  it("moves the thread on without touching its anchor or its status", async () => {
    const { ctx, scope, threadId } = await opened();
    const before = ctx.rows.get(threadId);

    await reply(asCtx(ctx), scope, threadId, remark("The Q3 scan"));

    expect(ctx.rows.get(threadId)).toMatchObject({
      status: "open",
      anchor: before?.anchor
    });
    expect(ctx.rows.get(threadId)?.updatedAt).toBeGreaterThanOrEqual(before?.updatedAt as number);
  });

  it("records the reply in the same transaction", async () => {
    const { ctx, scope, threadId } = await opened();

    await reply(asCtx(ctx), scope, threadId, remark("The Q3 scan"));

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "replied",
      target: { type: "commentThread", id: threadId }
    });
  });

  it("refuses a reply that says nothing", async () => {
    const { ctx, scope, threadId } = await opened();

    expect(await refusalFrom(reply(asCtx(ctx), scope, threadId, []))).toMatchObject({
      code: "empty-body"
    });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, elsewhere, threadId } = await opened();

    expect(
      await refusalFrom(reply(asCtx(ctx), elsewhere, threadId, remark("The Q3 scan")))
    ).toMatchObject({ code: "not-found" });
  });

  /** A resolved discussion is still a discussion; reopening is a separate intent. */
  it("adds to a resolved thread rather than reopening it", async () => {
    const { ctx, scope, threadId } = await opened();
    await ctx.db.patch(threadId, { status: "resolved" });

    await reply(asCtx(ctx), scope, threadId, remark("One more thing"));

    expect(ctx.rows.get(threadId)).toMatchObject({ status: "resolved" });
  });
});

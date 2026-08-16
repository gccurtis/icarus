import { describe, expect, it } from "vitest";
import { reopen } from "$comments/api/reopen/reopen";
import { resolve } from "$comments/api/resolve/resolve";
import { start } from "$comments/api/start/start";
import { asCtx, asking, documentOf, paragraph, refusalFrom, remark } from "$comments/test/fixture";

const resolved = async () => {
  const { ctx, scope, userId, elsewhere } = await asking();
  const targetId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const threadId = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId },
    blocks: remark()
  });
  await resolve(asCtx(ctx), scope, threadId);

  return { ctx, scope, userId, elsewhere, threadId };
};

describe("reopen", () => {
  /** Resolution is reversible, which is what makes "resolved rather than deleted" hold. */
  it("returns the thread to open and clears who closed it", async () => {
    const { ctx, scope, threadId } = await resolved();

    await reopen(asCtx(ctx), scope, threadId);

    expect(ctx.rows.get(threadId)).toMatchObject({ status: "open" });
    expect(ctx.rows.get(threadId)?.resolvedBy).toBeUndefined();
    expect(ctx.rows.get(threadId)?.resolvedAt).toBeUndefined();
  });

  it("records the reopening in the same transaction", async () => {
    const { ctx, scope, threadId } = await resolved();

    await reopen(asCtx(ctx), scope, threadId);

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "reopened",
      target: { type: "commentThread", id: threadId }
    });
  });

  it("refuses to reopen a thread nobody closed", async () => {
    const { ctx, scope, threadId } = await resolved();
    await reopen(asCtx(ctx), scope, threadId);

    expect(await refusalFrom(reopen(asCtx(ctx), scope, threadId))).toMatchObject({
      code: "wrong-status"
    });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, elsewhere, threadId } = await resolved();

    expect(await refusalFrom(reopen(asCtx(ctx), elsewhere, threadId))).toMatchObject({
      code: "not-found"
    });
  });
});

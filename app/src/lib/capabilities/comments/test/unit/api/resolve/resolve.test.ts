import { describe, expect, it } from "vitest";
import { resolve } from "$comments/api/resolve/resolve";
import { start } from "$comments/api/start/start";
import { asCtx, asking, documentOf, paragraph, refusalFrom, remark } from "$comments/test/fixture";

const opened = async () => {
  const { ctx, scope, userId, elsewhere } = await asking();
  const targetId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const threadId = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId },
    blocks: remark()
  });

  return { ctx, scope, userId, elsewhere, threadId };
};

describe("resolve", () => {
  it("closes the thread, naming who closed it and when", async () => {
    const { ctx, scope, userId, threadId } = await opened();

    await resolve(asCtx(ctx), scope, threadId);

    expect(ctx.rows.get(threadId)).toMatchObject({ status: "resolved", resolvedBy: userId });
    expect(ctx.rows.get(threadId)?.resolvedAt).toEqual(expect.any(Number));
  });

  /**
   * A user id, not an actor. Anything can raise a remark — an agent reviewing a
   * document routinely does — but closing one is a judgement a person makes.
   */
  it("records the resolver as a user rather than as an actor", async () => {
    const { ctx, scope, userId, threadId } = await opened();

    await resolve(asCtx(ctx), scope, threadId);

    expect(ctx.rows.get(threadId)?.resolvedBy).toBe(userId);
    expect(ctx.rows.get(threadId)?.createdBy).toEqual({ kind: "user", userId });
  });

  /**
   * Resolved hides, it does not destroy. A review discussion is often the only
   * record of why something is the way it is.
   */
  it("keeps the thread and its comments", async () => {
    const { ctx, scope, threadId } = await opened();

    await resolve(asCtx(ctx), scope, threadId);

    expect(ctx.rows.get(threadId)).toBeDefined();
    expect([...ctx.rows.values()].filter((row) => row._table === "comments")).toHaveLength(1);
  });

  it("records the resolution in the same transaction", async () => {
    const { ctx, scope, threadId } = await opened();

    await resolve(asCtx(ctx), scope, threadId);

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "resolved",
      target: { type: "commentThread", id: threadId }
    });
  });

  /** Re-resolving would overwrite who closed it, which is the one thing the row records. */
  it("refuses to resolve a thread that is already resolved", async () => {
    const { ctx, scope, threadId } = await opened();
    await resolve(asCtx(ctx), scope, threadId);

    expect(await refusalFrom(resolve(asCtx(ctx), scope, threadId))).toMatchObject({
      code: "wrong-status"
    });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, elsewhere, threadId } = await opened();

    expect(await refusalFrom(resolve(asCtx(ctx), elsewhere, threadId))).toMatchObject({
      code: "not-found"
    });
  });
});

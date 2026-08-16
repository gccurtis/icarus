import { describe, expect, it } from "vitest";
import { edit } from "$comments/api/edit/edit";
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
  const id = [...ctx.rows.entries()].find(([, row]) => row._table === "comments")![0] as Id<"comments">;

  return { ctx, scope, userId, elsewhere, threadId, id };
};

describe("edit", () => {
  it("replaces the words and marks the remark as changed", async () => {
    const { ctx, scope, id } = await opened();

    await edit(asCtx(ctx), scope, id, remark("Where is this figure from?"));

    expect(ctx.rows.get(id)).toMatchObject({ blocks: remark("Where is this figure from?") });
    expect(ctx.rows.get(id)?.editedAt).toEqual(expect.any(Number));
  });

  /** The prior text is not kept: a remark is a conversation turn, not a document. */
  it("keeps no history of what it replaced", async () => {
    const { ctx, scope, id } = await opened();

    await edit(asCtx(ctx), scope, id, remark("Rewritten"));

    expect(ctx.rows.get(id)).not.toHaveProperty("history");
    expect(ctx.rows.get(id)).not.toHaveProperty("revision");
  });

  it("replaces the mentions with the ones the new words carry", async () => {
    const { ctx, scope, threadId } = await opened();
    const id = await reply(asCtx(ctx), scope, threadId, remark("@Researcher?"), [
      { kind: "persona", personaId: "personas:1" }
    ]);

    await edit(asCtx(ctx), scope, id, remark("Never mind"), []);

    expect(ctx.rows.get(id)?.mentions).toEqual([]);
  });

  /** Editing words attributed to someone else rewrites what they are recorded as saying. */
  it("refuses to edit somebody else's remark", async () => {
    const { ctx, scope, threadId } = await opened();
    const theirs = (await ctx.db.insert("comments", {
      projectId: scope.projectId,
      threadId,
      blocks: remark("A colleague's"),
      author: { kind: "user", userId: "users:9" }
    })) as Id<"comments">;

    expect(await refusalFrom(edit(asCtx(ctx), scope, theirs, remark("Mine now")))).toMatchObject({
      code: "not-author"
    });
  });

  it("refuses to edit an agent's remark, which nobody authored", async () => {
    const { ctx, scope, threadId } = await opened();
    const agents = (await ctx.db.insert("comments", {
      projectId: scope.projectId,
      threadId,
      blocks: remark("Reviewed and inconsistent with the Q3 scan"),
      author: { kind: "agent", taskId: "agentTasks:1" }
    })) as Id<"comments">;

    expect(await refusalFrom(edit(asCtx(ctx), scope, agents, remark("No it isn't")))).toMatchObject({
      code: "not-author"
    });
  });

  it("refuses an edit that empties the remark", async () => {
    const { ctx, scope, id } = await opened();

    expect(await refusalFrom(edit(asCtx(ctx), scope, id, []))).toMatchObject({
      code: "empty-body"
    });
  });

  it("records the edit in the same transaction", async () => {
    const { ctx, scope, threadId, id } = await opened();

    await edit(asCtx(ctx), scope, id, remark("Rewritten"));

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "edited",
      target: { type: "commentThread", id: threadId }
    });
  });

  it("reports not found for a comment in another project", async () => {
    const { ctx, elsewhere, id } = await opened();

    expect(await refusalFrom(edit(asCtx(ctx), elsewhere, id, remark("Mine now")))).toMatchObject({
      code: "not-found"
    });
  });
});

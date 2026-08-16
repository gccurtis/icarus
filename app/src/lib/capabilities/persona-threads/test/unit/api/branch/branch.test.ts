import { describe, expect, it } from "vitest";
import { branch } from "$persona-threads/api/branch/branch";
import {
  asCtx,
  chatting,
  messagesIn,
  refusalFrom,
  rowsOf,
  saidIn,
  threadIn
} from "$persona-threads/test/fixture";

/** A thread with two turns in it, which is the shape branching is about. */
const inProgress = async () => {
  const world = await chatting();
  const threadId = await threadIn(world.ctx, world.scope.projectId, world.persona);
  const first = await saidIn(world.ctx, world.scope.projectId, threadId, "What moved margin?");
  const second = await saidIn(world.ctx, world.scope.projectId, threadId, "Input costs");

  return { ...world, threadId, first, second };
};

describe("branch", () => {
  it("records the message it continued from, and the thread it was in", async () => {
    const { ctx, scope, userId, persona, threadId, first } = await inProgress();

    const id = await branch(asCtx(ctx), scope, { threadId, messageId: first }, "A different tack");

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      personaId: persona,
      title: "A different tack",
      branchedFrom: { threadId, messageId: first },
      createdBy: { kind: "user", userId }
    });
    // `target.label` is the branch's own title; `context.label` freezes the
    // source's, which is the branch-specific part of the entry.
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "branched",
      target: { type: "personaThread", id, label: "A different tack" },
      context: { type: "personaThread", id: threadId, label: "Q3 margin" }
    });
  });

  /**
   * The whole answer to "I want to change what I said": messages are
   * append-only, so you take a different path from a point you liked and both
   * paths remain.
   */
  it("leaves the original thread and its messages exactly as they were", async () => {
    const { ctx, scope, threadId, first } = await inProgress();
    const before = { ...ctx.rows.get(threadId) };
    const messagesBefore = rowsOf(ctx, "messages");

    await branch(asCtx(ctx), scope, { threadId, messageId: first }, "A different tack");

    expect(ctx.rows.get(threadId)).toEqual(before);
    expect(rowsOf(ctx, "messages")).toEqual(messagesBefore);
  });

  it("copies no messages into the thread it opens", async () => {
    const { ctx, scope, threadId, first } = await inProgress();

    const id = await branch(asCtx(ctx), scope, { threadId, messageId: first }, "A different tack");

    // What came before is reached through `branchedFrom`. Copying it would be a
    // second copy of an append-only log, free to disagree with the first.
    expect(messagesIn(ctx, id)).toHaveLength(0);
    expect(messagesIn(ctx, threadId)).toHaveLength(2);
  });

  it("keeps the title of the thread it came from when none is given", async () => {
    const { ctx, scope, threadId, second } = await inProgress();

    const id = await branch(asCtx(ctx), scope, { threadId, messageId: second });

    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 margin" });
  });

  it("reports not found for a message that is not in that thread", async () => {
    const { ctx, scope, persona, threadId, first } = await inProgress();
    const other = await threadIn(ctx, scope.projectId, persona, "Somewhere else");

    expect(
      await refusalFrom(branch(asCtx(ctx), scope, { threadId: other, messageId: first }))
    ).toMatchObject({ code: "not-found" });
    expect(rowsOf(ctx, "personaThreads")).toHaveLength(2);
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere, theirPersona } = await inProgress();
    const theirs = await threadIn(ctx, elsewhere.projectId, theirPersona);
    const message = await saidIn(ctx, elsewhere.projectId, theirs, "Not yours");

    expect(
      await refusalFrom(branch(asCtx(ctx), scope, { threadId: theirs, messageId: message }))
    ).toMatchObject({ code: "not-found" });
  });
});

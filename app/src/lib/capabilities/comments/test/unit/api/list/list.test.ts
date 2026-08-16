import { describe, expect, it } from "vitest";
import { list } from "$comments/api/list/list";
import { reply } from "$comments/api/reply/reply";
import { resolve } from "$comments/api/resolve/resolve";
import { start } from "$comments/api/start/start";
import {
  asCtx,
  asking,
  deckOf,
  documentOf,
  paragraph,
  remark,
  scopeOf
} from "$comments/test/fixture";

const discussed = async () => {
  const { ctx, scope, userId, elsewhere } = await asking();
  const documentId = await documentOf(ctx, scope, paragraph("b7x2", "The figures are wrong"));
  const deckId = await deckOf(ctx, scope, "s3");

  const onDocument = await start(asCtx(ctx), scope, {
    anchor: { targetType: "document", targetId: documentId },
    blocks: remark("Where is this from?")
  });
  const onDeck = await start(asCtx(ctx), scope, {
    anchor: { targetType: "slides", targetId: deckId, within: { kind: "slide", slideId: "s3" } },
    blocks: remark("This one needs rework")
  });

  return { ctx, scope, userId, elsewhere, documentId, deckId, onDocument, onDeck };
};

describe("list", () => {
  it("returns one target's threads and no other's", async () => {
    const { ctx, scope, documentId, onDocument } = await discussed();

    const threads = await list(asCtx(ctx), scope, {
      targetType: "document",
      targetId: documentId
    });

    expect(threads.map((thread) => thread.id)).toEqual([onDocument]);
  });

  it("returns the project's threads when no target is named", async () => {
    const { ctx, scope, onDocument, onDeck } = await discussed();

    const threads = await list(asCtx(ctx), scope);

    expect(threads.map((thread) => thread.id).sort()).toEqual([onDocument, onDeck].sort());
  });

  /** A thread without its replies renders nothing, so they come with it. */
  it("carries each thread's comments, in the order they were written", async () => {
    const { ctx, scope, documentId, onDocument } = await discussed();
    await reply(asCtx(ctx), scope, onDocument, remark("The Q3 scan"));

    const [thread] = await list(asCtx(ctx), scope, {
      targetType: "document",
      targetId: documentId
    });

    expect(thread.comments.map((comment) => comment.blocks[0])).toMatchObject([
      { display: "Where is this from?" },
      { display: "The Q3 scan" }
    ]);
  });

  it("gives a thread its own comments and no other thread's", async () => {
    const { ctx, scope, onDeck, deckId } = await discussed();

    const [thread] = await list(asCtx(ctx), scope, { targetType: "slides", targetId: deckId });

    expect(thread.id).toBe(onDeck);
    expect(thread.comments).toHaveLength(1);
  });

  /** Hiding a resolved thread is the client's decision; this hides nothing. */
  it("returns resolved threads too", async () => {
    const { ctx, scope, documentId, onDocument } = await discussed();
    await resolve(asCtx(ctx), scope, onDocument);

    const threads = await list(asCtx(ctx), scope, {
      targetType: "document",
      targetId: documentId
    });

    expect(threads).toMatchObject([{ status: "resolved" }]);
  });

  it("returns nothing for a project with no discussion in it", async () => {
    const { ctx, elsewhere } = await discussed();

    expect(await list(asCtx(ctx), elsewhere)).toEqual([]);
  });

  it("does not reach a thread in another project through its target", async () => {
    const { ctx, ...rest } = await discussed();
    const stranger = scopeOf(rest.elsewhere.projectId, rest.userId);

    expect(
      await list(asCtx(ctx), stranger, { targetType: "document", targetId: rest.documentId })
    ).toEqual([]);
  });

  it("drops projectId, which every row shares with the project asked about", async () => {
    const { ctx, scope, documentId } = await discussed();

    const [thread] = await list(asCtx(ctx), scope, {
      targetType: "document",
      targetId: documentId
    });

    expect(thread).not.toHaveProperty("projectId");
    expect(thread.comments[0]).not.toHaveProperty("projectId");
  });
});

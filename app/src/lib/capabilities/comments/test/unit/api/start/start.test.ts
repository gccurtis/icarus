import { describe, expect, it } from "vitest";
import { start } from "$comments/api/start/start";
import {
  asCtx,
  asking,
  deckOf,
  documentOf,
  paragraph,
  refusalFrom,
  remark
} from "$comments/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

const SENTENCE = "The quarterly figures are wrong";

const onDocument = async () => {
  const { ctx, scope, userId, elsewhere } = await asking();
  const documentId = await documentOf(ctx, scope, paragraph("b7x2", SENTENCE));

  return {
    ctx,
    scope,
    userId,
    elsewhere,
    anchor: { targetType: "document" as const, targetId: documentId }
  };
};

describe("start", () => {
  it("scopes the thread it opens to the caller's project", async () => {
    const { ctx, scope, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, { anchor, blocks: remark() });

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, status: "open" });
  });

  /** Nobody has closed it, so there is nobody to name. */
  it("opens it with no resolver and no resolution time", async () => {
    const { ctx, scope, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, { anchor, blocks: remark() });

    expect(ctx.rows.get(id)).not.toHaveProperty("resolvedBy");
    expect(ctx.rows.get(id)).not.toHaveProperty("resolvedAt");
  });

  it("attributes the thread to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, { anchor, blocks: remark() });

    expect(ctx.rows.get(id)).toMatchObject({ createdBy: { kind: "user", userId } });
  });

  /** A thread with no remark on it is an anchor nobody can act on, so both land together. */
  it("writes the first comment in the same transaction", async () => {
    const { ctx, scope, userId, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, { anchor, blocks: remark("Where is this from?") });

    const comment = [...ctx.rows.values()].find((row) => row._table === "comments");
    expect(comment).toMatchObject({
      projectId: scope.projectId,
      threadId: id,
      author: { kind: "user", userId }
    });
  });

  it("carries the mentions extracted beside the blocks", async () => {
    const { ctx, scope, userId, anchor } = await onDocument();

    await start(asCtx(ctx), scope, {
      anchor,
      blocks: remark("@Researcher does this hold?"),
      mentions: [
        { kind: "persona", personaId: "personas:1" as Id<"personas"> },
        { kind: "user", userId: userId as Id<"users"> }
      ]
    });

    const comment = [...ctx.rows.values()].find((row) => row._table === "comments");
    expect(comment?.mentions).toEqual([
      { kind: "persona", personaId: "personas:1" },
      { kind: "user", userId }
    ]);
  });

  it("records the remark in the same transaction, against the thing it is about", async () => {
    const { ctx, scope, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, { anchor, blocks: remark() });

    expect(ctx.log.at(-1)).toMatchObject({
      projectId: scope.projectId,
      verb: "commented",
      target: { type: "commentThread", id },
      context: { type: "document", id: anchor.targetId }
    });
  });

  /** The matrix is the model's; this is the one assertion that the mutation applies it. */
  it("refuses a within the target cannot hold", async () => {
    const { ctx, scope, anchor } = await onDocument();

    expect(
      await refusalFrom(
        start(asCtx(ctx), scope, {
          anchor: { ...anchor, within: { kind: "cell", sheetId: "s1", ref: "B7" } },
          blocks: remark()
        })
      )
    ).toMatchObject({ code: "anchor-mismatch" });
  });

  it("refuses a thread whose first remark says nothing", async () => {
    const { ctx, scope, anchor } = await onDocument();

    expect(await refusalFrom(start(asCtx(ctx), scope, { anchor, blocks: [] }))).toMatchObject({
      code: "empty-body"
    });
    expect(ctx.log.filter((entry) => entry.verb === "commented")).toEqual([]);
  });

  it("stores the range as it stands now, not as the author sent it", async () => {
    const { ctx, scope, anchor } = await onDocument();

    const id = await start(asCtx(ctx), scope, {
      anchor: { ...anchor, within: { kind: "text", blockId: "b7x2", from: 4, to: 13 } },
      blocks: remark(),
      baseRevision: 0
    });

    expect(ctx.rows.get(id)?.anchor).toMatchObject({
      within: { from: 4, to: 13 },
      quote: "quarterly"
    });
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, elsewhere, anchor } = await onDocument();

    expect(
      await refusalFrom(start(asCtx(ctx), elsewhere, { anchor, blocks: remark() }))
    ).toMatchObject({ code: "not-found" });
  });

  /**
   * A deck-level remark and a slide-level one are different remarks, so they are
   * different threads — the model keeps them apart and so does the anchor stored.
   */
  it("keeps a slide-level remark apart from a deck-level one", async () => {
    const { ctx, scope } = await asking();
    const deck = { targetType: "slides" as const, targetId: await deckOf(ctx, scope, "s3") };

    const whole = await start(asCtx(ctx), scope, { anchor: deck, blocks: remark("Too long") });
    const slide = await start(asCtx(ctx), scope, {
      anchor: { ...deck, within: { kind: "slide", slideId: "s3" } },
      blocks: remark("This one needs rework")
    });

    expect(whole).not.toBe(slide);
    expect(ctx.rows.get(whole)?.anchor).toEqual(deck);
    expect(ctx.rows.get(slide)?.anchor).toMatchObject({ within: { kind: "slide", slideId: "s3" } });
  });
});

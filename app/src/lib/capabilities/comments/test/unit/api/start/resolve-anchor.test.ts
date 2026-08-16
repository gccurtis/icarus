import { describe, expect, it } from "vitest";
import { resolveAnchor } from "$comments/api/start/resolve-anchor";
import type { CommentAnchor } from "$comments/types/anchor";
import { asCtx, asking, documentOf, paragraph, refusalFrom } from "$comments/test/fixture";
import type { Op } from "$revisions/types/change";
import { submit } from "$revisions/api/submit/submit";

const SENTENCE = "The quarterly figures are wrong";

/** "quarterly", at the offsets a selection in that sentence produces. */
const onQuarterly = (documentId: string): CommentAnchor => ({
  targetType: "document",
  targetId: documentId,
  within: { kind: "text", blockId: "b7x2", from: 4, to: 13 }
});

const anchored = async () => {
  const { ctx, scope, elsewhere } = await asking();
  const documentId = await documentOf(ctx, scope, paragraph("b7x2", SENTENCE));
  const change = async (baseRevision: number, ...ops: Op[]) =>
    await submit(asCtx(ctx), scope, {
      resourceType: "document",
      resourceId: documentId,
      baseRevision,
      ops
    });

  return { ctx, scope, elsewhere, documentId, change };
};

const typing = (at: number, insert: string, remove = ""): Op => ({
  op: "text",
  target: "atom",
  path: "#b7x2/atoms/#b7x2a",
  at,
  insert,
  remove
});

describe("resolveAnchor", () => {
  /**
   * The property the whole anchor design rests on: an anchor names an id, so it
   * is the same block wherever it moves and whatever is inserted above it.
   */
  it("still resolves an anchor to #b7x2 after a block is inserted above it", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, {
      op: "insert",
      target: "row",
      path: "rows",
      after: null,
      values: [{ id: "r-new", kind: "blocks", blocks: [paragraph("b1", "Added above")] }]
    });

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.within).toEqual({ kind: "text", blockId: "b7x2", from: 4, to: 13 });
  });

  it("moves a range past text typed in front of it", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, typing(0, "Actually, "));

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.within).toMatchObject({ from: 14, to: 23 });
  });

  it("leaves a range alone when the text after it is edited", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, typing(SENTENCE.length, " again"));

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.within).toMatchObject({ from: 4, to: 13 });
  });

  /** Both bounds sit on the edit's own, so the range covers what replaced the word. */
  it("follows a range onto the text that replaced it", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, typing(4, "annual", "quarterly"));

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.within).toMatchObject({ from: 4, to: 10 });
    expect(anchor.quote).toBe("quarterly");
  });

  /**
   * Nobody is left to reject to by the time an edit has been accepted, so a bound
   * that lands strictly inside replaced text collapses to the edit point rather
   * than refusing — and `quote` is what makes that recognizable as drifted rather
   * than as a remark about whatever now sits there.
   */
  it("collapses a bound the edit ran through, and keeps the quote", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, typing(9, "X", "erly figures"));

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.within).toMatchObject({ from: 4, to: 9 });
    expect(anchor.quote).toBe("quarterly");
  });

  it("takes the quote from the body the author was looking at", async () => {
    const { ctx, scope, documentId } = await anchored();

    const anchor = await resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0);

    expect(anchor.quote).toBe("quarterly");
  });

  it("refuses an anchor to a block that has been removed", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, {
      op: "remove",
      target: "row",
      path: "rows",
      ids: ["r-b7x2"],
      after: null,
      values: []
    });

    expect(
      await refusalFrom(resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 0))
    ).toMatchObject({ code: "anchor-missing" });
  });

  it("refuses a selection made against a revision the window no longer holds", async () => {
    const { ctx, scope, documentId } = await anchored();

    expect(
      await refusalFrom(resolveAnchor(asCtx(ctx), scope, onQuarterly(documentId), 7))
    ).toMatchObject({ code: "anchor-stale" });
  });

  /** A remark about the document as a whole has nothing inside it to follow. */
  it("passes a whole-resource anchor through untouched", async () => {
    const { ctx, scope, documentId, change } = await anchored();
    await change(0, typing(0, "Actually, "));
    const whole: CommentAnchor = { targetType: "document", targetId: documentId };

    expect(await resolveAnchor(asCtx(ctx), scope, whole)).toEqual(whole);
  });

  /**
   * `questions`, `hypotheses`, and `findings` arrive in pass 4, and an external
   * file has no body at all — the anchor is a kind and an id, so it does not need
   * a resource to resolve against.
   */
  it("stores an anchor to a target with no body as it was given", async () => {
    const { ctx, scope } = await asking();
    const finding: CommentAnchor = {
      targetType: "finding",
      targetId: "findings:1",
      within: { kind: "text", blockId: "b1", from: 0, to: 4 },
      quote: "Only"
    };

    expect(await resolveAnchor(asCtx(ctx), scope, finding, 0)).toEqual(finding);
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, elsewhere, documentId } = await anchored();

    expect(
      await refusalFrom(resolveAnchor(asCtx(ctx), elsewhere, onQuarterly(documentId), 0))
    ).toMatchObject({ code: "not-found" });
    expect(scope.projectId).not.toBe(elsewhere.projectId);
  });
});

import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { asCtx, asking, notes, refusalFrom } from "$questions/test/fixture";

describe("ask", () => {
  it("scopes what it creates to the caller's project, open and unanswered", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await ask(asCtx(ctx), scope, { text: "  Why did margin fall?  ", notes: [] });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      text: "Why did margin fall?",
      status: "open",
      revision: 1,
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "asked",
      target: { type: "question", id, label: "Why did margin fall?" }
    });
  });

  it("starts at the root, with no parent and no arrays hung off it", async () => {
    const { ctx, scope } = await asking();

    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: notes("Q3") });

    const row = ctx.rows.get(id);
    expect(row?.parentId).toBeUndefined();
    expect(row).not.toHaveProperty("hypotheses");
    expect(row).not.toHaveProperty("findings");
  });

  it("hangs a sub-question off its parent", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    const id = await ask(asCtx(ctx), scope, { text: "Did input costs move?", notes: [], parentId });

    expect(ctx.rows.get(id)).toMatchObject({ parentId });
  });

  it("reports not found for a parent in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const parentId = await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });

    // Not "forbidden": distinguishing them confirms the question exists to
    // someone with no right to know that.
    expect(
      await refusalFrom(ask(asCtx(ctx), scope, { text: "Mine", notes: [], parentId }))
    ).toMatchObject({ code: "not-found" });
  });

  it("refuses a question with nothing asked in it, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(ask(asCtx(ctx), scope, { text: "   ", notes: [] }))).toMatchObject({
      code: "empty-text"
    });
    expect(ctx.log).toHaveLength(0);
  });
});

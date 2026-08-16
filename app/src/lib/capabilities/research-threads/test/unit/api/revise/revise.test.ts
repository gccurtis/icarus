import { describe, expect, it } from "vitest";
import { revise } from "$research-threads/api/revise/revise";
import { start } from "$research-threads/api/start/start";
import { asCtx, refusalFrom, researching } from "$research-threads/test/fixture";

const wandering = async () => {
  const found = await researching();
  const id = await start(asCtx(found.ctx), found.scope, {
    title: "Wandering",
    mode: "discover"
  });
  return { ...found, id };
};

describe("revise", () => {
  it("anchors a discover thread to the question it turned up", async () => {
    const { ctx, scope, here, id } = await wandering();

    await revise(asCtx(ctx), scope, id, 1, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });

    // Discovery finding its question is the workflow, not a mistake being fixed.
    expect(ctx.rows.get(id)).toMatchObject({
      title: "Margin",
      mode: "question",
      questionId: here.questionId,
      revision: 2
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "revised",
      target: { type: "researchThread", id, label: "Margin" }
    });
  });

  it("clears the anchor when the thread goes back to discovering", async () => {
    const { ctx, scope, here, id } = await wandering();
    await revise(asCtx(ctx), scope, id, 1, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });

    await revise(asCtx(ctx), scope, id, 2, { title: "Margin", mode: "discover" });

    // The draft is the whole thread, so an absent anchor means no anchor —
    // otherwise `mode` and the ids could disagree about what the thread is about.
    expect(ctx.rows.get(id)?.questionId).toBeUndefined();
  });

  it("refuses a form opened at a revision the thread has moved past", async () => {
    const { ctx, scope, id } = await wandering();

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 7, { title: "Margin", mode: "discover" }))
    ).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Wandering", revision: 1 });
  });

  it("refuses a question thread with no question", async () => {
    const { ctx, scope, id } = await wandering();

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { title: "Margin", mode: "question" }))
    ).toMatchObject({ code: "missing-anchor" });
    expect(ctx.rows.get(id)).toMatchObject({ mode: "discover", revision: 1 });
  });

  it("reports not found for an anchor in another project", async () => {
    const { ctx, scope, there, id } = await wandering();

    expect(
      await refusalFrom(
        revise(asCtx(ctx), scope, id, 1, {
          title: "Margin",
          mode: "question",
          questionId: there.questionId
        })
      )
    ).toMatchObject({ code: "not-found" });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere } = await researching();
    const id = await start(asCtx(ctx), elsewhere, { title: "Theirs", mode: "discover" });

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { title: "Mine", mode: "discover" }))
    ).toMatchObject({ code: "not-found" });
  });
});

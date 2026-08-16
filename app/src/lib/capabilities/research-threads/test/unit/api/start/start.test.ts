import { describe, expect, it } from "vitest";
import { start } from "$research-threads/api/start/start";
import { asCtx, refusalFrom, researching } from "$research-threads/test/fixture";

describe("start", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId } = await researching();

    const id = await start(asCtx(ctx), scope, { title: "  Margin  ", mode: "discover" });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      title: "Margin",
      mode: "discover",
      revision: 1,
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "started",
      target: { type: "researchThread", id, label: "Margin" }
    });
  });

  it("starts a discover thread with nothing to anchor to", async () => {
    const { ctx, scope } = await researching();

    const id = await start(asCtx(ctx), scope, { title: "What is going on?", mode: "discover" });

    // Discovery is how questions get found in the first place. An unanchored
    // discover thread is the normal case, not a loose end.
    const row = ctx.rows.get(id);
    expect(row?.questionId).toBeUndefined();
    expect(row?.hypothesisId).toBeUndefined();
  });

  it("is itself the thread, so it creates no conversation beside it", async () => {
    const { ctx, scope } = await researching();

    const id = await start(asCtx(ctx), scope, { title: "Margin", mode: "discover" });

    // Messages name this row; `by_thread(("research", id))` is the whole link.
    const row = ctx.rows.get(id);
    expect(row).not.toHaveProperty("chatId");
    expect(row).not.toHaveProperty("threadId");
    expect([...ctx.rows.values()].filter((r) => r._table === "messages")).toHaveLength(0);
  });

  it("anchors a pointed thread to what it is about", async () => {
    const { ctx, scope, here } = await researching();

    const onQuestion = await start(asCtx(ctx), scope, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });
    const onHypothesis = await start(asCtx(ctx), scope, {
      title: "Input costs",
      mode: "hypothesis",
      hypothesisId: here.hypothesisId
    });

    expect(ctx.rows.get(onQuestion)).toMatchObject({ questionId: here.questionId });
    expect(ctx.rows.get(onHypothesis)).toMatchObject({ hypothesisId: here.hypothesisId });
  });

  it("refuses a question thread with no question, writing nothing", async () => {
    const { ctx, scope } = await researching();

    expect(
      await refusalFrom(start(asCtx(ctx), scope, { title: "Margin", mode: "question" }))
    ).toMatchObject({ code: "missing-anchor" });
    expect(ctx.log).toHaveLength(0);
  });

  it("reports not found for an anchor in another project", async () => {
    const { ctx, scope, there } = await researching();

    // Not "forbidden": distinguishing them confirms the question exists to
    // someone with no right to know that.
    expect(
      await refusalFrom(
        start(asCtx(ctx), scope, {
          title: "Margin",
          mode: "question",
          questionId: there.questionId
        })
      )
    ).toMatchObject({ code: "not-found" });
  });

  it("refuses a thread nobody can pick out of a list", async () => {
    const { ctx, scope } = await researching();

    expect(
      await refusalFrom(start(asCtx(ctx), scope, { title: "  ", mode: "discover" }))
    ).toMatchObject({ code: "empty-title" });
  });
});

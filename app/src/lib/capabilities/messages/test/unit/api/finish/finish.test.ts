import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { finish } from "$messages/api/finish/finish";
import { post } from "$messages/api/post/post";
import { asCtx, asking, refusalFrom, research, said } from "$messages/test/fixture";

const streaming = async () => {
  const context = await asking();
  const id = await post(asCtx(context.ctx), context.scope, {
    thread: research("researchThreads:1"),
    role: "response",
    blocks: [],
    streaming: true
  });
  return { ...context, id };
};

describe("finish", () => {
  it("closes a turn with what it ended up saying", async () => {
    const { ctx, scope, id } = await streaming();

    await finish(asCtx(ctx), scope, id, {
      blocks: said("Input costs, mostly."),
      toolCalls: [{ name: "search", input: { query: "margin" }, state: "success" }],
      sources: [{ kind: "lattice", nodeId: "latticeNodes:1" }]
    });

    expect(ctx.rows.get(id)).toMatchObject({ state: "complete" });
    expect(ctx.rows.get(id)?.error).toBeUndefined();
  });

  it("keeps what a turn managed to say when it died on the way", async () => {
    const { ctx, scope, id } = await streaming();

    await finish(asCtx(ctx), scope, id, {
      blocks: said("Three sources agr"),
      error: "the model connection dropped"
    });

    // A turn that failed halfway is still a turn: what it said and the tools it
    // called are the record of how far it got.
    expect(ctx.rows.get(id)).toMatchObject({
      state: "error",
      error: "the model connection dropped"
    });
  });

  it("refuses to finish a turn that already ended", async () => {
    const { ctx, scope, person } = await asking();
    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "prompt",
      blocks: said("What moved margin?"),
      author: person
    });

    // Messages are append-only. Finishing a settled turn would rewrite what
    // somebody is recorded as having said.
    expect(
      await refusalFrom(finish(asCtx(ctx), scope, id, { blocks: said("Something else") }))
    ).toMatchObject({ code: "not-streaming" });
    expect(ctx.rows.get(id)).toMatchObject({ state: "complete" });
  });

  it("reports not found for a turn in another project", async () => {
    const { ctx, elsewhere, id } = await streaming();

    // Not forbidden: distinguishing them confirms the turn exists to someone
    // with no right to know that.
    expect(
      await refusalFrom(finish(asCtx(ctx), elsewhere, id, { blocks: said("Anything") }))
    ).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)).toMatchObject({ state: "streaming" });
  });

  it("reports not found for a turn that never existed", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(
        finish(asCtx(ctx), scope, "messages:404" as Id<"messages">, { blocks: [] })
      )
    ).toMatchObject({ code: "not-found" });
  });
});

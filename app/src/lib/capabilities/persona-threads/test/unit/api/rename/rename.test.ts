import { describe, expect, it } from "vitest";
import { rename } from "$persona-threads/api/rename/rename";
import { asCtx, chatting, refusalFrom, threadIn } from "$persona-threads/test/fixture";

describe("rename", () => {
  it("retitles the thread and touches nothing else", async () => {
    const { ctx, scope, persona } = await chatting();
    const id = await threadIn(ctx, scope.projectId, persona, "Q3 margin");

    await rename(asCtx(ctx), scope, id, "  What moved margin  ");

    expect(ctx.rows.get(id)).toMatchObject({ title: "What moved margin", personaId: persona });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "renamed",
      target: { type: "personaThread", id, label: "What moved margin" }
    });
  });

  it("refuses a title nobody can pick out of a list", async () => {
    const { ctx, scope, persona } = await chatting();
    const id = await threadIn(ctx, scope.projectId, persona, "Q3 margin");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, " "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 margin" });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere, theirPersona } = await chatting();
    const id = await threadIn(ctx, elsewhere.projectId, theirPersona, "Theirs");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "Mine now"))).toMatchObject({
      code: "not-found"
    });
  });
});

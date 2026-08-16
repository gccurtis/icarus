import { describe, expect, it } from "vitest";
import { read } from "$persona-threads/api/read/read";
import { asCtx, chatting, refusalFrom, scopeOf, threadIn } from "$persona-threads/test/fixture";

describe("read", () => {
  it("opens a thread by its own address", async () => {
    const { ctx, scope, persona } = await chatting();
    const id = await threadIn(ctx, scope.projectId, persona, "Q3 margin");

    expect(await read(asCtx(ctx), scope, id)).toMatchObject({ id, title: "Q3 margin" });
  });

  it("lets any member of the project read it, not only whoever started it", async () => {
    // Threads are project content rather than private correspondence; membership
    // is the whole boundary, and a finer one is deliberately not modelled.
    const { ctx, scope, persona } = await chatting();
    const id = await threadIn(ctx, scope.projectId, persona, "Q3 margin");
    const colleague = await ctx.db.insert("users", {
      authSubject: "colleague",
      displayName: "A Colleague",
      updatedAt: 1
    });

    expect(await read(asCtx(ctx), scopeOf(scope.projectId, colleague), id)).toMatchObject({ id });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere, theirPersona } = await chatting();
    const id = await threadIn(ctx, elsewhere.projectId, theirPersona, "Theirs");

    expect(await refusalFrom(read(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
  });
});

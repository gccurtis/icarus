import { describe, expect, it } from "vitest";
import { list } from "$persona-threads/api/list/list";
import { asCtx, chatting, threadIn } from "$persona-threads/test/fixture";

describe("list", () => {
  it("returns the project's threads and no other project's", async () => {
    const { ctx, scope, elsewhere, persona, theirPersona } = await chatting();
    await threadIn(ctx, scope.projectId, persona, "Mine");
    await threadIn(ctx, elsewhere.projectId, theirPersona, "Theirs");

    const found = await list(asCtx(ctx), scope);

    expect(found.map((thread) => thread.title)).toEqual(["Mine"]);
  });

  it("narrows to one persona's chats in a single indexed read", async () => {
    const { ctx, scope, persona, everyonesPersona } = await chatting();
    await threadIn(ctx, scope.projectId, persona, "With the researcher");
    await threadIn(ctx, scope.projectId, everyonesPersona, "With everyone's");

    const found = await list(asCtx(ctx), scope, persona);

    expect(found.map((thread) => thread.title)).toEqual(["With the researcher"]);
  });

  it("drops projectId, which every caller already knows", async () => {
    const { ctx, scope, persona } = await chatting();
    await threadIn(ctx, scope.projectId, persona, "Mine");

    const [thread] = await list(asCtx(ctx), scope);

    expect(thread).not.toHaveProperty("projectId");
    expect(thread.personaId).toBe(persona);
  });
});

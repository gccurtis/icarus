import { describe, expect, it } from "vitest";
import { start } from "$persona-threads/api/start/start";
import { asCtx, chatting, refusalFrom, rowsOf } from "$persona-threads/test/fixture";
import { personasRefusal } from "$personas/errors";

describe("start", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId, persona } = await chatting();

    const id = await start(asCtx(ctx), scope, persona, "  Q3 margin  ");

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      personaId: persona,
      title: "Q3 margin",
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "started",
      target: { type: "personaThread", id, label: "Q3 margin" }
    });
  });

  it("is itself the thread, so it opens no conversation beside it", async () => {
    const { ctx, scope, persona } = await chatting();

    const id = await start(asCtx(ctx), scope, persona, "Q3 margin");

    // Messages name this row; `by_thread(("persona", id))` is the whole link.
    expect(ctx.rows.get(id)).not.toHaveProperty("chatId");
    expect(rowsOf(ctx, "messages")).toHaveLength(0);
  });

  it("carries no status, because a chat is not a unit of work", async () => {
    const { ctx, scope, persona } = await chatting();

    const id = await start(asCtx(ctx), scope, persona, "Q3 margin");

    expect(ctx.rows.get(id)).not.toHaveProperty("status");
  });

  it("opens a chat with a persona belonging to every project", async () => {
    const { ctx, scope, everyonesPersona } = await chatting();

    const id = await start(asCtx(ctx), scope, everyonesPersona, "Q3 margin");

    expect(ctx.rows.get(id)).toMatchObject({ personaId: everyonesPersona });
  });

  it("reports not found for a persona in another project", async () => {
    const { ctx, scope, theirPersona } = await chatting();

    // The refusal is the personas capability's, unchanged: it owns "absent means
    // yours too", and restating it here is how the two answers start to differ.
    const refusal = await start(asCtx(ctx), scope, theirPersona, "Q3 margin").then(
      () => undefined,
      (error: unknown) => personasRefusal(error)
    );

    expect(refusal).toMatchObject({ capability: "personas", code: "not-found" });
    expect(rowsOf(ctx, "personaThreads")).toHaveLength(0);
  });

  it("refuses a thread nobody can pick out of a list", async () => {
    const { ctx, scope, persona } = await chatting();

    expect(await refusalFrom(start(asCtx(ctx), scope, persona, "  "))).toMatchObject({
      code: "empty-title"
    });
  });
});

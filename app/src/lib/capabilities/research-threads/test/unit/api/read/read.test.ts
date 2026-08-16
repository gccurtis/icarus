import { describe, expect, it } from "vitest";
import { read } from "$research-threads/api/read/read";
import { start } from "$research-threads/api/start/start";
import { asCtx, refusalFrom, researching } from "$research-threads/test/fixture";

describe("read", () => {
  it("returns the one thread, with what it is anchored to", async () => {
    const { ctx, scope, userId, here } = await researching();
    const id = await start(asCtx(ctx), scope, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });

    expect(await read(asCtx(ctx), scope, id)).toMatchObject({
      id,
      title: "Margin",
      mode: "question",
      questionId: here.questionId,
      revision: 1,
      createdBy: { kind: "user", userId }
    });
  });

  it("carries no conversation with it", async () => {
    const { ctx, scope } = await researching();
    const id = await start(asCtx(ctx), scope, { title: "Wandering", mode: "discover" });

    // Turns are read by `messages.list(("research", id))`, which is one indexed
    // read and needs nothing from here.
    const thread = await read(asCtx(ctx), scope, id);
    expect(thread).not.toHaveProperty("messages");
    expect(thread).not.toHaveProperty("chatId");
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere } = await researching();
    const id = await start(asCtx(ctx), elsewhere, { title: "Theirs", mode: "discover" });

    // Not "forbidden": distinguishing them confirms a conversation about
    // something is happening.
    expect(await refusalFrom(read(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
  });
});

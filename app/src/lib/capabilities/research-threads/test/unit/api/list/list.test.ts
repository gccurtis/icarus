import { describe, expect, it } from "vitest";
import { list } from "$research-threads/api/list/list";
import { start } from "$research-threads/api/start/start";
import { asCtx, researching } from "$research-threads/test/fixture";

describe("list", () => {
  it("returns the project's threads, anchored or not", async () => {
    const { ctx, scope, here } = await researching();
    await start(asCtx(ctx), scope, { title: "Wandering", mode: "discover" });
    await start(asCtx(ctx), scope, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });

    // A discover thread is inside the list rather than stranded outside it:
    // `projectId` is on the row rather than reached through a question.
    expect((await list(asCtx(ctx), scope)).map((thread) => thread.title)).toEqual([
      "Wandering",
      "Margin"
    ]);
  });

  it("narrows to the threads working on one question", async () => {
    const { ctx, scope, here } = await researching();
    await start(asCtx(ctx), scope, { title: "Wandering", mode: "discover" });
    await start(asCtx(ctx), scope, {
      title: "Margin",
      mode: "question",
      questionId: here.questionId
    });

    const found = await list(asCtx(ctx), scope, here.questionId);

    expect(found.map((thread) => thread.title)).toEqual(["Margin"]);
    expect(found[0]).toMatchObject({ mode: "question", revision: 1 });
  });

  it("reads no other project's threads", async () => {
    const { ctx, scope, elsewhere } = await researching();
    await start(asCtx(ctx), elsewhere, { title: "Theirs", mode: "discover" });

    expect(await list(asCtx(ctx), scope)).toEqual([]);
  });

  it("says nothing about the conversation, which is read by thread", async () => {
    const { ctx, scope } = await researching();
    await start(asCtx(ctx), scope, { title: "Wandering", mode: "discover" });

    const [thread] = await list(asCtx(ctx), scope);
    expect(thread).not.toHaveProperty("chatId");
    expect(thread).not.toHaveProperty("messages");
    expect(thread).not.toHaveProperty("projectId");
  });
});

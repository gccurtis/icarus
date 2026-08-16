import { describe, expect, it } from "vitest";
import { post } from "$messages/api/post/post";
import { asCtx, asking, persona, refusalFrom, research, said } from "$messages/test/fixture";

describe("post", () => {
  it("scopes what it appends to the caller's project", async () => {
    const { ctx, scope, person } = await asking();

    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "prompt",
      blocks: said("What moved margin in Q3?"),
      author: person
    });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      thread: { kind: "research", id: "researchThreads:1" },
      role: "prompt",
      author: person,
      state: "complete"
    });
  });

  it("names the thread it belongs to and stores no pointer back", async () => {
    const { ctx, scope, person } = await asking();

    const id = await post(asCtx(ctx), scope, {
      thread: persona("personaThreads:7"),
      role: "prompt",
      blocks: [],
      author: person
    });

    // The consumer's own `_id` is the key. A thread id column on either side
    // would be a second copy of the same link to keep in sync.
    const row = ctx.rows.get(id);
    expect(row).not.toHaveProperty("threadId");
    expect(row).not.toHaveProperty("chatId");
  });

  it("refuses a prompt nobody is asking, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(
        post(asCtx(ctx), scope, {
          thread: research("researchThreads:1"),
          role: "prompt",
          blocks: said("What moved margin?")
        })
      )
    ).toMatchObject({ code: "prompt-unauthored" });
    expect([...ctx.rows.values()].filter((row) => row._table === "messages")).toHaveLength(0);
  });

  it("appends a response with no author, meaning the thread's own responder", async () => {
    const { ctx, scope } = await asking();

    const id = await post(asCtx(ctx), scope, {
      thread: persona("personaThreads:7"),
      role: "response",
      blocks: said("Input costs, mostly.")
    });

    // A persona answering in its own chat. Presence would name somebody else.
    expect(ctx.rows.get(id)?.author).toBeUndefined();
  });

  it("opens a turn a responder is still producing", async () => {
    const { ctx, scope } = await asking();

    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "response",
      blocks: [],
      streaming: true
    });

    expect(ctx.rows.get(id)).toMatchObject({ state: "streaming" });
  });

  it("carries the work behind a turn as tool calls, payloads uninterpreted", async () => {
    const { ctx, scope } = await asking();

    const input = { query: "Q3 margin", filters: { kind: ["document"] } };
    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "response",
      blocks: said("Three sources agree."),
      toolCalls: [{ name: "search", input, state: "success", output: [1, 2, 3], durationMs: 42 }],
      sources: [{ kind: "url", url: "https://example.test/report", excerpt: "margin fell 4pts" }]
    });

    // A search *is* a tool call, and only the tool can read its own arguments.
    expect(ctx.rows.get(id)?.toolCalls).toEqual([
      { name: "search", input, state: "success", output: [1, 2, 3], durationMs: 42 }
    ]);
    expect(ctx.rows.get(id)).not.toHaveProperty("steps");
  });
});

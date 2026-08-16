import { describe, expect, it } from "vitest";
import { list } from "$messages/api/list/list";
import { post } from "$messages/api/post/post";
import { asCtx, asking, persona, research, said, spoken, task } from "$messages/test/fixture";

describe("list", () => {
  it("returns one thread's turns and no other's", async () => {
    const { ctx, scope, person } = await asking();
    const here = research("researchThreads:1");

    await post(asCtx(ctx), scope, {
      thread: here,
      role: "prompt",
      blocks: said("Ours"),
      author: person
    });
    await post(asCtx(ctx), scope, {
      thread: research("researchThreads:2"),
      role: "prompt",
      blocks: said("Another research thread"),
      author: person
    });
    await post(asCtx(ctx), scope, {
      thread: persona("personaThreads:1"),
      role: "prompt",
      blocks: said("A persona chat"),
      author: person
    });

    const turns = await list(asCtx(ctx), scope, here);

    expect(turns.map((turn) => spoken(turn.blocks))).toEqual(["Ours"]);
  });

  it("keeps threads of different kinds apart even when they share an id", async () => {
    const { ctx, scope, person } = await asking();

    await post(asCtx(ctx), scope, {
      thread: research("7"),
      role: "prompt",
      blocks: said("In the research thread"),
      author: person
    });
    await post(asCtx(ctx), scope, {
      thread: task("7"),
      role: "prompt",
      blocks: said("In the agent task"),
      author: person
    });

    // Three tables mint ids into one column, so the discriminant is half the key.
    const turns = await list(asCtx(ctx), scope, task("7"));

    expect(turns).toHaveLength(1);
    expect(spoken(turns[0]?.blocks ?? [])).toBe("In the agent task");
  });

  it("returns nothing for a thread in another project", async () => {
    const { ctx, scope, elsewhere, person } = await asking();
    const thread = research("researchThreads:1");

    await post(asCtx(ctx), scope, { thread, role: "prompt", blocks: said("Ours"), author: person });

    // The message's own `projectId` decides, so a read never joins upward to a
    // thread row to find out whether it was allowed to look.
    expect(await list(asCtx(ctx), elsewhere, thread)).toEqual([]);
  });

  it("returns turns in the order they were taken", async () => {
    const { ctx, scope, person } = await asking();
    const thread = research("researchThreads:1");

    await post(asCtx(ctx), scope, { thread, role: "prompt", blocks: said("First"), author: person });
    await post(asCtx(ctx), scope, { thread, role: "response", blocks: said("Second") });
    await post(asCtx(ctx), scope, { thread, role: "prompt", blocks: said("Third"), author: person });

    // Appends are the only writes, so the index range is already the order and
    // nothing stores a rank.
    expect((await list(asCtx(ctx), scope, thread)).map((turn) => spoken(turn.blocks))).toEqual([
      "First",
      "Second",
      "Third"
    ]);
  });

  it("says which side each turn is on and drops the thread it was read by", async () => {
    const { ctx, scope, person } = await asking();
    const thread = research("researchThreads:1");

    await post(asCtx(ctx), scope, { thread, role: "prompt", blocks: said("Ask"), author: person });
    await post(asCtx(ctx), scope, { thread, role: "response", blocks: said("Answer") });

    const turns = await list(asCtx(ctx), scope, thread);

    expect(turns.map((turn) => turn.role)).toEqual(["prompt", "response"]);
    expect(turns[0]).not.toHaveProperty("thread");
    expect(turns[0]).not.toHaveProperty("projectId");
    expect(turns[0]?.at).toBeGreaterThan(0);
  });
});

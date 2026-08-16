import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { revise } from "$questions/api/revise/revise";
import { asCtx, asking, notes, refusalFrom } from "$questions/test/fixture";

describe("revise", () => {
  it("writes the wording and the context, and moves the revision on", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    await revise(asCtx(ctx), scope, id, 1, {
      text: "Why did gross margin fall in Q3?",
      notes: notes("Ruled out FX")
    });

    expect(ctx.rows.get(id)).toMatchObject({
      text: "Why did gross margin fall in Q3?",
      revision: 2
    });
    expect(ctx.log.at(-1)).toMatchObject({ verb: "revised" });
  });

  it("rejects a write against a stale revision, changing nothing", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    await revise(asCtx(ctx), scope, id, 1, { text: "Someone else got here first", notes: [] });

    // Rejection is the whole mechanism: the client is told the question moved and
    // decides what to do. No merging, no field-level reconciliation.
    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { text: "Saved over lunch", notes: [] }))
    ).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(id)).toMatchObject({
      text: "Someone else got here first",
      revision: 2
    });
  });

  it("moves a question under another, and back to the root", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    const id = await ask(asCtx(ctx), scope, { text: "Did input costs move?", notes: [] });

    await revise(asCtx(ctx), scope, id, 1, { text: "Did input costs move?", notes: [], parentId });
    expect(ctx.rows.get(id)).toMatchObject({ parentId });

    await revise(asCtx(ctx), scope, id, 2, { text: "Did input costs move?", notes: [] });
    expect(ctx.rows.get(id)?.parentId).toBeUndefined();
  });

  it("refuses a parent that is the question's own descendant", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    const childId = await ask(asCtx(ctx), scope, {
      text: "Did input costs move?",
      notes: [],
      parentId
    });

    const refusal = await refusalFrom(
      revise(asCtx(ctx), scope, parentId, 1, {
        text: "Why did margin fall?",
        notes: [],
        parentId: childId
      })
    );

    expect(refusal).toMatchObject({ code: "cycle" });
    expect(ctx.rows.get(parentId)?.parentId).toBeUndefined();
  });

  it("reports not found for a question in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { text: "Mine now", notes: [] }))
    ).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)).toMatchObject({ text: "Their question" });
  });
});

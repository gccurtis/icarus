import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { remove } from "$questions/api/remove/remove";
import { asCtx, asking, refusalFrom } from "$questions/test/fixture";

describe("remove", () => {
  it("deletes the question, naming it in the log while it can still be read", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    // Deleting is how a question nobody intends to pursue leaves the list, since
    // there is no status that means "we are not doing this".
    await remove(asCtx(ctx), scope, id);

    expect(ctx.rows.get(id)).toBeUndefined();
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "question", id, label: "Why did margin fall?" }
    });
  });

  it("refuses to strand the sub-questions hanging off it", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    await ask(asCtx(ctx), scope, { text: "Did input costs move?", notes: [], parentId });

    expect(await refusalFrom(remove(asCtx(ctx), scope, parentId))).toMatchObject({
      code: "has-children"
    });
    expect(ctx.rows.get(parentId)).toBeDefined();
  });

  it("reports not found for a question in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });

    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)).toBeDefined();
  });
});

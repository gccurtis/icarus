import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { list } from "$questions/api/list/list";
import { asCtx, asking, notes } from "$questions/test/fixture";

describe("list", () => {
  it("returns the caller's project and no other's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: notes("Q3") });
    await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });

    const found = await list(asCtx(ctx), scope);

    expect(found.map((question) => question.text)).toEqual(["Why did margin fall?"]);
    expect(found[0]?.notes).toHaveLength(1);
  });

  it("returns one question's children when asked for them", async () => {
    const { ctx, scope } = await asking();
    const parentId = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    await ask(asCtx(ctx), scope, { text: "Did input costs move?", notes: [], parentId });
    await ask(asCtx(ctx), scope, { text: "Unrelated", notes: [] });

    const children = await list(asCtx(ctx), scope, parentId);

    expect(children.map((question) => question.text)).toEqual(["Did input costs move?"]);
  });
});

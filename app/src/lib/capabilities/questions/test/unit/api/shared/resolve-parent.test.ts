import { describe, expect, it } from "vitest";
import { ask } from "$questions/api/ask/ask";
import { resolveParent } from "$questions/api/shared/resolve-parent";
import { asCtx, asking, refusalFrom } from "$questions/test/fixture";

describe("resolveParent", () => {
  it("takes no parent to mean the root", async () => {
    const { ctx, scope } = await asking();

    expect(await resolveParent(asCtx(ctx), scope, undefined)).toBeUndefined();
  });

  it("refuses a question as its own parent", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    expect(await refusalFrom(resolveParent(asCtx(ctx), scope, id, id))).toMatchObject({
      code: "cycle"
    });
  });

  it("walks the whole line of ancestors, not just the one above", async () => {
    const { ctx, scope } = await asking();
    const top = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });
    const middle = await ask(asCtx(ctx), scope, {
      text: "Did input costs move?",
      notes: [],
      parentId: top
    });
    const bottom = await ask(asCtx(ctx), scope, {
      text: "Which inputs?",
      notes: [],
      parentId: middle
    });

    expect(await refusalFrom(resolveParent(asCtx(ctx), scope, bottom, top))).toMatchObject({
      code: "cycle"
    });
    expect(await resolveParent(asCtx(ctx), scope, bottom, undefined)).toBe(bottom);
  });
});

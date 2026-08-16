import { describe, expect, it } from "vitest";
import { create } from "$documents/api/create/create";
import { remove } from "$documents/api/remove/remove";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$documents/test/fixture";

describe("remove", () => {
  it("copies the title into the log before the row it names is gone", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    await remove(asCtx(ctx), scope, id);

    expect(ctx.rows.has(id)).toBe(false);
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "document", id, label: "Q3 plan" }
    });
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their plan");

    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(ctx.rows.has(id)).toBe(true);
  });
});

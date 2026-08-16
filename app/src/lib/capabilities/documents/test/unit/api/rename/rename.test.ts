import { describe, expect, it } from "vitest";
import { create } from "$documents/api/create/create";
import { rename } from "$documents/api/rename/rename";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$documents/test/fixture";

describe("rename", () => {
  it("writes the new title, who wrote it, and an entry naming it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    await rename(asCtx(ctx), scope, id, "Q4 plan");

    expect(ctx.rows.get(id)).toMatchObject({
      title: "Q4 plan",
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "renamed",
      target: { type: "document", id, label: "Q4 plan" }
    });
  });

  it("refuses to rename a document to nothing, leaving the name it had", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "   "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 plan" });
    expect(ctx.log).toHaveLength(1);
  });

  it("reports not found for a document in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their plan");

    // Not "forbidden": distinguishing the two confirms the document exists to
    // someone with no right to know that.
    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "Mine now"))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Their plan" });
  });
});

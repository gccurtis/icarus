import { describe, expect, it } from "vitest";
import { create } from "$spreadsheets/api/create/create";
import { rename } from "$spreadsheets/api/rename/rename";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$spreadsheets/test/fixture";

describe("rename", () => {
  it("writes the new title, who wrote it, and an entry naming it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Budget");

    await rename(asCtx(ctx), scope, id, "Budget 2027");

    expect(ctx.rows.get(id)).toMatchObject({
      title: "Budget 2027",
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "renamed",
      target: { type: "spreadsheet", id, label: "Budget 2027" }
    });
  });

  it("refuses to rename a workbook to nothing, leaving the name it had", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Budget");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "   "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Budget" });
    expect(ctx.log).toHaveLength(1);
  });

  it("reports not found for a workbook in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their budget");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "Mine now"))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Their budget" });
  });
});

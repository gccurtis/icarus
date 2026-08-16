import { describe, expect, it } from "vitest";
import { create } from "$spreadsheets/api/create/create";
import { list } from "$spreadsheets/api/list/list";
import { asCtx, asking, projectNamed, scopeOf } from "$spreadsheets/test/fixture";

describe("list", () => {
  it("returns the caller's project's workbooks and no other's", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await create(asCtx(ctx), scope, "Mine");
    await create(asCtx(ctx), theirs, "Theirs");

    expect((await list(asCtx(ctx), scope)).map((workbook) => workbook.title)).toEqual(["Mine"]);
  });

  it("carries what a list renders and nothing of the row it read", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Budget");

    const [workbook] = await list(asCtx(ctx), scope);

    expect(workbook).toEqual({
      id,
      title: "Budget",
      templateId: undefined,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: expect.any(Number) as number
    });
  });
});

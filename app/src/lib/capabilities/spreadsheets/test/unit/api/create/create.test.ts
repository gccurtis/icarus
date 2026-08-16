import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import { create } from "$spreadsheets/api/create/create";
import { asCtx, asking, refusalFrom } from "$spreadsheets/test/fixture";
import { emptySpreadsheetBody } from "$spreadsheets/types/body";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Budget");

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, title: "Budget" });
  });

  it("attributes the row to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, "Budget");

    expect(ctx.rows.get(id)).toMatchObject({
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
  });

  it("records the creation in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Budget");

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "created",
      target: { type: "spreadsheet", id, label: "Budget" }
    });
  });

  it("anchors an empty body, so the workbook opens before anyone edits it", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Budget");

    expect(await read(asCtx(ctx), scope, { resourceType: "spreadsheet", resourceId: id })).toEqual({
      revision: 0,
      body: emptySpreadsheetBody()
    });
  });

  it("stores the title as it will be read, not as it was typed", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "  Budget  ");

    expect(ctx.rows.get(id)).toMatchObject({ title: "Budget" });
  });

  it("refuses a workbook with no name", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(create(asCtx(ctx), scope, "   "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.log).toEqual([]);
  });
});

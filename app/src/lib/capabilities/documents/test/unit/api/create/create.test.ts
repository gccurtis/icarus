import { describe, expect, it } from "vitest";
import { create } from "$documents/api/create/create";
import { asCtx, asking, refusalFrom } from "$documents/test/fixture";
import { read } from "$revisions/api/read/read";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, title: "Q3 plan" });
  });

  it("attributes the row to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.rows.get(id)).toMatchObject({
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
  });

  it("records the creation in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "created",
      target: { type: "document", id, label: "Q3 plan" }
    });
  });

  it("anchors an empty body, so the document opens before anyone edits it", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan");

    expect(
      await read(asCtx(ctx), scope, { resourceType: "document", resourceId: id })
    ).toEqual({ revision: 0, body: { rows: [] } });
  });

  it("keeps the template it was made from as provenance", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 plan", "templates:1");

    expect(ctx.rows.get(id)).toMatchObject({ templateId: "templates:1" });
  });

  it("stores the title as it will be read, not as it was typed", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "  Q3 plan  ");

    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 plan" });
    expect(ctx.log[0]).toMatchObject({ target: { label: "Q3 plan" } });
  });

  it("refuses a document with no name", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(create(asCtx(ctx), scope, "   "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.log).toEqual([]);
  });
});

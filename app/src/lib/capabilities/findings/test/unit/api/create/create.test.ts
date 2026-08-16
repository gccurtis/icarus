import { describe, expect, it } from "vitest";
import { create } from "$findings/api/create/create";
import { asCtx, asking, body, captured, refusalFrom } from "$findings/test/fixture";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, {
      title: "  Margin fell on input costs  ",
      body: body("Supplier invoices are up 12%"),
      sources: []
    });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      title: "Margin fell on input costs",
      revision: 1,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "recorded",
      target: { type: "finding", id, label: "Margin fell on input costs" }
    });
  });

  it("keeps each source's excerpt and capture time as they were read", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      title: "Margin fell",
      body: [],
      sources: [captured("Margin fell 4 points")]
    });

    // Pages change and get taken down. A citation that is only a pointer
    // degrades into an unfalsifiable claim the moment its target moves.
    expect(ctx.rows.get(id)?.sources).toEqual([
      {
        kind: "url",
        url: "https://example.test/report",
        title: "Q3 report",
        excerpt: "Margin fell 4 points",
        capturedAt: 1_700_000_000_000
      }
    ]);
  });

  it("stores a resource source under both its type and its id", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      title: "Margin fell",
      body: [],
      sources: [{ kind: "resource", resourceType: "spreadsheet", resourceId: "spreadsheets:1" }]
    });

    // The pair is the key: two resources of different kinds may carry the same id.
    expect(ctx.rows.get(id)?.sources).toEqual([
      { kind: "resource", resourceType: "spreadsheet", resourceId: "spreadsheets:1" }
    ]);
  });

  it("attaches to no question and no hypothesis, and is a legal row anyway", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, { title: "Nobody asked", body: [], sources: [] });

    // Research turns up things nobody was looking for, and requiring a question
    // would push those into the wrong one or lose them.
    const row = ctx.rows.get(id);
    expect(row).not.toHaveProperty("questionId");
    expect(row).not.toHaveProperty("hypothesisId");
    expect(row).not.toHaveProperty("bearing");
  });

  it("refuses a finding nothing can cite, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(create(asCtx(ctx), scope, { title: "  ", body: [], sources: [] }))
    ).toMatchObject({ code: "empty-title" });
    expect(ctx.log).toHaveLength(0);
  });

  it("refuses a citation that points nowhere, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(
        create(asCtx(ctx), scope, {
          title: "Margin fell",
          body: [],
          sources: [{ kind: "manual", note: "   " }]
        })
      )
    ).toMatchObject({ code: "empty-source" });
    expect(ctx.log).toHaveLength(0);
  });
});

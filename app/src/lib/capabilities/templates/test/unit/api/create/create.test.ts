import { describe, expect, it } from "vitest";
import { create } from "$templates/api/create/create";
import {
  asCtx,
  asking,
  documentTemplateBody,
  refusalFrom,
  slidesTemplateBody
} from "$templates/test/fixture";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, name: "Client report" });
  });

  /**
   * The row's label is written from the body's, so the two cannot disagree — a
   * template claiming to make a document while holding slides is a picker that
   * lies and an instantiation that fails.
   */
  it("takes the target from the body rather than from an argument", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Pitch",
      body: slidesTemplateBody(),
      slots: []
    });

    expect(ctx.rows.get(id)).toMatchObject({ target: "slides" });
  });

  it("attributes the row to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    expect(ctx.rows.get(id)).toMatchObject({ createdBy: { kind: "user", userId }, revision: 1 });
  });

  it("keeps the slots it was given", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: [
        { key: "client_name", label: "Client name", kind: "text", required: true },
        { key: "summary", label: "Summary", kind: "derived", prompt: "Summarize the findings" }
      ]
    });

    expect(ctx.rows.get(id)).toMatchObject({
      slots: [
        { key: "client_name", kind: "text", required: true },
        { key: "summary", kind: "derived", prompt: "Summarize the findings" }
      ]
    });
  });

  it("records the creation in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "created",
      target: { type: "template", id, label: "Client report" }
    });
  });

  it("refuses a template nobody could pick out of a list", async () => {
    const { ctx, scope } = await asking();

    const refusal = await refusalFrom(
      create(asCtx(ctx), scope, { name: "  ", body: documentTemplateBody(), slots: [] })
    );

    expect(refusal).toMatchObject({ code: "empty-name" });
    expect(ctx.log).toEqual([]);
  });

  it("refuses a slot list a filled-in template could not honour", async () => {
    const { ctx, scope } = await asking();

    const refusal = await refusalFrom(
      create(asCtx(ctx), scope, {
        name: "Client report",
        body: documentTemplateBody(),
        slots: [
          { key: "client_name", label: "Client name", kind: "text" },
          { key: "client_name", label: "Client", kind: "text" }
        ]
      })
    );

    expect(refusal).toMatchObject({ code: "duplicate-slot-key" });
    expect(ctx.log).toEqual([]);
  });
});

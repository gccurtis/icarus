import { describe, expect, it } from "vitest";
import { create } from "$templates/api/create/create";
import { revise } from "$templates/api/revise/revise";
import {
  asCtx,
  asking,
  documentTemplateBody,
  globalTemplate,
  refusalFrom,
  slidesTemplateBody
} from "$templates/test/fixture";

const started = async () => {
  const context = await asking();
  const templateId = await create(asCtx(context.ctx), context.scope, {
    name: "Client report",
    body: documentTemplateBody(),
    slots: []
  });
  return { ...context, templateId };
};

describe("revise", () => {
  it("replaces the template and moves the revision on", async () => {
    const { ctx, scope, templateId } = await started();

    await revise(asCtx(ctx), scope, templateId, 1, {
      name: "Client report v2",
      description: "For retainer clients",
      body: documentTemplateBody("Retainer report"),
      slots: [{ key: "client_name", label: "Client name", kind: "text" }]
    });

    expect(ctx.rows.get(templateId)).toMatchObject({
      name: "Client report v2",
      description: "For retainer clients",
      revision: 2,
      slots: [{ key: "client_name" }]
    });
  });

  /**
   * The point of `revision` on the row. Convex's transactions cover a read and a
   * write in one mutation; they do not cover a form someone opened before lunch.
   */
  it("refuses a write authored against a revision that has moved", async () => {
    const { ctx, scope, templateId } = await started();
    await revise(asCtx(ctx), scope, templateId, 1, {
      name: "Client report",
      body: documentTemplateBody("First"),
      slots: []
    });

    const refusal = await refusalFrom(
      revise(asCtx(ctx), scope, templateId, 1, {
        name: "Client report",
        body: documentTemplateBody("Second"),
        slots: []
      })
    );

    expect(refusal).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(templateId)).toMatchObject({ revision: 2 });
  });

  it("refuses a body that would make this a template for something else", async () => {
    const { ctx, scope, templateId } = await started();

    const refusal = await refusalFrom(
      revise(asCtx(ctx), scope, templateId, 1, {
        name: "Client report",
        body: slidesTemplateBody(),
        slots: []
      })
    );

    expect(refusal).toMatchObject({ code: "target-changed" });
  });

  /**
   * A global template is readable everywhere and editable from nowhere in a
   * project-scoped surface — which keeps "who can edit this" answerable from the
   * template alone.
   */
  it("refuses to edit a global template from inside a project", async () => {
    const { ctx, scope } = await asking();
    const templateId = await globalTemplate(ctx, "Everyone's");

    const refusal = await refusalFrom(
      revise(asCtx(ctx), scope, templateId, 1, {
        name: "Mine now",
        body: documentTemplateBody(),
        slots: []
      })
    );

    expect(refusal).toMatchObject({ code: "not-editable" });
    expect(ctx.rows.get(templateId)).toMatchObject({ name: "Everyone's" });
  });

  it("reports not found for a template in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const templateId = await create(asCtx(ctx), elsewhere, {
      name: "Theirs",
      body: documentTemplateBody(),
      slots: []
    });

    const refusal = await refusalFrom(
      revise(asCtx(ctx), scope, templateId, 1, {
        name: "Mine now",
        body: documentTemplateBody(),
        slots: []
      })
    );

    expect(refusal).toMatchObject({ code: "not-found" });
  });

  it("records the revision in the same transaction", async () => {
    const { ctx, scope, templateId } = await started();

    await revise(asCtx(ctx), scope, templateId, 1, {
      name: "Client report v2",
      body: documentTemplateBody(),
      slots: []
    });

    expect(ctx.log.at(-1)).toMatchObject({
      verb: "revised",
      target: { type: "template", id: templateId, label: "Client report v2" }
    });
  });
});

import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import { create } from "$templates/api/create/create";
import { instantiate } from "$templates/api/instantiate/instantiate";
import { revise } from "$templates/api/revise/revise";
import {
  asCtx,
  asking,
  documentTemplateBody,
  globalTemplate,
  refusalFrom,
  slidesTemplateBody
} from "$templates/test/fixture";
import { resourceBodyOf } from "$templates/types/body";

describe("instantiate", () => {
  it("opens on the template's own content, not on an empty resource", async () => {
    const { ctx, scope } = await asking();
    const body = documentTemplateBody();
    const templateId = await create(asCtx(ctx), scope, { name: "Client report", body, slots: [] });

    const resource = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    expect(resource.resourceType).toBe("document");
    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(body)
    });
  });

  it("records the template as provenance and nothing more", async () => {
    const { ctx, scope } = await asking();
    const templateId = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    const { resourceId } = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    expect(ctx.rows.get(resourceId)).toMatchObject({
      projectId: scope.projectId,
      title: "Acme Q3",
      templateId
    });
  });

  /** The dispatch is [`resourceFrom`](resource-from.test.ts)'s; this is the wiring. */
  it("makes what the template's target says, not always a document", async () => {
    const { ctx, scope } = await asking();
    const templateId = await create(asCtx(ctx), scope, {
      name: "Pitch",
      body: slidesTemplateBody(),
      slots: []
    });

    const { resourceType, resourceId } = await instantiate(asCtx(ctx), scope, templateId, "Acme");

    expect(resourceType).toBe("slides");
    expect(ctx.rows.get(resourceId)).toMatchObject({ aspectRatio: "4:3", templateId });
  });

  it("instantiates a global template into the caller's own project", async () => {
    const { ctx, scope } = await asking();
    const templateId = await globalTemplate(ctx, "Everyone's");

    const { resourceId } = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    expect(ctx.rows.get(resourceId)).toMatchObject({ projectId: scope.projectId });
  });

  it("reports not found for a template in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const templateId = await create(asCtx(ctx), elsewhere, {
      name: "Theirs",
      body: documentTemplateBody(),
      slots: []
    });

    const refusal = await refusalFrom(instantiate(asCtx(ctx), scope, templateId, "Acme Q3"));

    expect(refusal).toMatchObject({ code: "not-found" });
  });

  it("records the use of the template in the same transaction", async () => {
    const { ctx, scope } = await asking();
    const templateId = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    const { resourceId } = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    expect(ctx.log.at(-1)).toMatchObject({
      verb: "instantiated",
      target: { type: "template", id: templateId, label: "Client report" },
      context: { type: "document", id: resourceId, label: "Acme Q3" }
    });
  });

  /**
   * **The copy is full, and this is the assertion that says so.**
   *
   * The alternative — a resource holding a diff against a live template — means
   * an edit to a template someone has never seen silently rewrites their
   * document, and means no resource can be read without also reading its
   * template.
   */
  it("leaves what it created untouched when the template is edited afterwards", async () => {
    const { ctx, scope } = await asking();
    const authored = documentTemplateBody("Client report");
    const templateId = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: authored,
      slots: []
    });
    const resource = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    await revise(asCtx(ctx), scope, templateId, 1, {
      name: "Client report",
      body: documentTemplateBody("Completely different"),
      slots: []
    });

    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(authored)
    });
  });
});

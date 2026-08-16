import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import { create } from "$templates/api/create/create";
import { instantiate } from "$templates/api/instantiate/instantiate";
import { remove } from "$templates/api/remove/remove";
import {
  asCtx,
  asking,
  documentTemplateBody,
  globalTemplate,
  refusalFrom
} from "$templates/test/fixture";
import { resourceBodyOf } from "$templates/types/body";

describe("remove", () => {
  it("deletes the caller's own template and says which one in the log", async () => {
    const { ctx, scope } = await asking();
    const templateId = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    await remove(asCtx(ctx), scope, templateId);

    expect(ctx.rows.has(templateId)).toBe(false);
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "deleted",
      target: { type: "template", id: templateId, label: "Client report" }
    });
  });

  it("refuses to delete a global template from inside a project", async () => {
    const { ctx, scope } = await asking();
    const templateId = await globalTemplate(ctx, "Everyone's");

    expect(await refusalFrom(remove(asCtx(ctx), scope, templateId))).toMatchObject({
      code: "not-editable"
    });
    expect(ctx.rows.has(templateId)).toBe(true);
  });

  it("reports not found for a template in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const templateId = await create(asCtx(ctx), elsewhere, {
      name: "Theirs",
      body: documentTemplateBody(),
      slots: []
    });

    expect(await refusalFrom(remove(asCtx(ctx), scope, templateId))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.has(templateId)).toBe(true);
  });

  /** Provenance is a copy's only tie to its template, so losing it loses nothing. */
  it("leaves the resources made from it whole", async () => {
    const { ctx, scope } = await asking();
    const body = documentTemplateBody();
    const templateId = await create(asCtx(ctx), scope, { name: "Client report", body, slots: [] });
    const resource = await instantiate(asCtx(ctx), scope, templateId, "Acme Q3");

    await remove(asCtx(ctx), scope, templateId);

    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(body)
    });
  });
});

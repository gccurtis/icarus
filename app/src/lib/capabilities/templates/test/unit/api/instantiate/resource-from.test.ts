import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { read } from "$revisions/api/read/read";
import { resourceFrom } from "$templates/api/instantiate/resource-from";
import {
  asCtx,
  asking,
  documentTemplateBody,
  slidesTemplateBody,
  spreadsheetTemplateBody
} from "$templates/test/fixture";
import { resourceBodyOf } from "$templates/types/body";

const templateId = "templates:1" as Id<"templates">;

/** The dispatch: a body's target decides which capability writes the row. */
describe("resourceFrom", () => {
  it("makes a document, opened on the template's own content", async () => {
    const { ctx, scope } = await asking();
    const body = documentTemplateBody();

    const resource = await resourceFrom(asCtx(ctx), scope, "Acme Q3", templateId, body);

    expect(resource.resourceType).toBe("document");
    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(body)
    });
  });

  /**
   * The deck row carries the shape, so a slides template that could not state one
   * would make every deck the default shape whatever it was authored at.
   */
  it("makes a deck at the shape its template states", async () => {
    const { ctx, scope } = await asking();
    const body = slidesTemplateBody();

    const resource = await resourceFrom(asCtx(ctx), scope, "Acme", templateId, body);

    expect(resource.resourceType).toBe("slides");
    expect(ctx.rows.get(resource.resourceId)).toMatchObject({ aspectRatio: "4:3", templateId });
    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(body)
    });
  });

  it("makes a workbook", async () => {
    const { ctx, scope } = await asking();
    const body = spreadsheetTemplateBody();

    const resource = await resourceFrom(asCtx(ctx), scope, "Acme budget", templateId, body);

    expect(resource.resourceType).toBe("spreadsheet");
    expect(await read(asCtx(ctx), scope, resource)).toEqual({
      revision: 0,
      body: resourceBodyOf(body)
    });
  });
});

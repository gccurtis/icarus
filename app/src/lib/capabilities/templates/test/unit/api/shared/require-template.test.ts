import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { create } from "$templates/api/create/create";
import { requireTemplate } from "$templates/api/shared/require-template";
import {
  asCtx,
  asking,
  documentTemplateBody,
  globalTemplate,
  refusalFrom
} from "$templates/test/fixture";

describe("requireTemplate", () => {
  it("admits the caller's own", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    expect(await requireTemplate(asCtx(ctx), scope, id)).toMatchObject({ name: "Client report" });
  });

  it("admits a template belonging to no project, from any project", async () => {
    const { ctx, scope } = await asking();
    const id = await globalTemplate(ctx, "Everyone's");

    expect(await requireTemplate(asCtx(ctx), scope, id)).toMatchObject({ name: "Everyone's" });
  });

  it("reports not found for another project's, and for one that never existed", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await create(asCtx(ctx), elsewhere, {
      name: "Theirs",
      body: documentTemplateBody(),
      slots: []
    });

    expect(await refusalFrom(requireTemplate(asCtx(ctx), scope, id))).toMatchObject({
      code: "not-found"
    });
    expect(
      await refusalFrom(requireTemplate(asCtx(ctx), scope, "templates:404" as Id<"templates">))
    ).toMatchObject({ code: "not-found" });
  });
});

import { describe, expect, it } from "vitest";
import { create } from "$templates/api/create/create";
import { requireOwnTemplate } from "$templates/api/shared/require-own-template";
import {
  asCtx,
  asking,
  documentTemplateBody,
  globalTemplate,
  refusalFrom
} from "$templates/test/fixture";

describe("requireOwnTemplate", () => {
  it("admits the caller's own", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: []
    });

    expect(await requireOwnTemplate(asCtx(ctx), scope, id)).toMatchObject({
      projectId: scope.projectId
    });
  });

  /**
   * Not "not found": a global template is in the list the caller just read, so
   * refusing as though it were absent would deny something they can see and
   * withhold the one thing they need told — copy it, then edit the copy.
   */
  it("refuses a global as not editable rather than as absent", async () => {
    const { ctx, scope } = await asking();
    const id = await globalTemplate(ctx, "Everyone's");

    expect(await refusalFrom(requireOwnTemplate(asCtx(ctx), scope, id))).toMatchObject({
      code: "not-editable"
    });
  });

  it("reports not found for another project's, as the procedure it is built on does", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await create(asCtx(ctx), elsewhere, {
      name: "Theirs",
      body: documentTemplateBody(),
      slots: []
    });

    expect(await refusalFrom(requireOwnTemplate(asCtx(ctx), scope, id))).toMatchObject({
      code: "not-found"
    });
  });
});

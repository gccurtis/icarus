import { describe, expect, it } from "vitest";
import { create } from "$templates/api/create/create";
import { list } from "$templates/api/list/list";
import { asCtx, asking, documentTemplateBody, globalTemplate } from "$templates/test/fixture";

describe("list", () => {
  /**
   * The assertion the optional tenant column exists for: both ranges are read,
   * and neither reaches the third project's row.
   */
  it("returns the caller's templates and the global ones, and no other project's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await create(asCtx(ctx), scope, { name: "Mine", body: documentTemplateBody(), slots: [] });
    await create(asCtx(ctx), elsewhere, { name: "Theirs", body: documentTemplateBody(), slots: [] });
    await globalTemplate(ctx, "Everyone's");

    const names = (await list(asCtx(ctx), scope)).map((template) => template.name).sort();

    expect(names).toEqual(["Everyone's", "Mine"]);
  });

  it("says which of them came from everywhere, because that is what says who may edit it", async () => {
    const { ctx, scope } = await asking();
    await create(asCtx(ctx), scope, { name: "Mine", body: documentTemplateBody(), slots: [] });
    await globalTemplate(ctx, "Everyone's");

    const byName = new Map((await list(asCtx(ctx), scope)).map((t) => [t.name, t.global]));

    expect(byName.get("Mine")).toBe(false);
    expect(byName.get("Everyone's")).toBe(true);
  });

  /**
   * `target` is on the row precisely so a picker can filter without this read
   * dragging every authored body across the wire.
   */
  it("carries the target and not the body", async () => {
    const { ctx, scope } = await asking();
    await create(asCtx(ctx), scope, {
      name: "Client report",
      body: documentTemplateBody(),
      slots: [{ key: "client_name", label: "Client name", kind: "text" }]
    });

    const [template] = await list(asCtx(ctx), scope);

    expect(template).toMatchObject({ target: "document", slots: [{ key: "client_name" }] });
    expect(template).not.toHaveProperty("body");
  });
});

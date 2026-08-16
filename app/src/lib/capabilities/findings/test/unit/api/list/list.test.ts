import { describe, expect, it } from "vitest";
import { create } from "$findings/api/create/create";
import { list } from "$findings/api/list/list";
import { asCtx, asking, body, captured } from "$findings/test/fixture";

describe("list", () => {
  it("returns the caller's project and no other's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await create(asCtx(ctx), scope, { title: "Margin fell", body: [], sources: [] });
    await create(asCtx(ctx), elsewhere, { title: "Their finding", body: [], sources: [] });

    const found = await list(asCtx(ctx), scope);

    expect(found.map((finding) => finding.title)).toEqual(["Margin fell"]);
  });

  it("carries the title without the writeup behind it", async () => {
    const { ctx, scope } = await asking();
    await create(asCtx(ctx), scope, {
      title: "Margin fell",
      body: body("Supplier invoices are up 12%"),
      sources: [captured("Margin fell 4 points")]
    });

    const [summary] = await list(asCtx(ctx), scope);

    // `title` is a separate column so a list, a link, and a search result get it
    // without shipping a writeup with tables and images in it.
    expect(summary).not.toHaveProperty("body");
    expect(summary).not.toHaveProperty("sources");
    expect(summary).toMatchObject({ title: "Margin fell", sourceCount: 1 });
  });

  it("returns a finding attached to nothing", async () => {
    const { ctx, scope } = await asking();
    await create(asCtx(ctx), scope, { title: "Nobody asked", body: [], sources: [] });

    // `projectId` is on the row rather than reached through a question, which is
    // what keeps an unattached finding inside the project's own query.
    expect(await list(asCtx(ctx), scope)).toHaveLength(1);
  });
});

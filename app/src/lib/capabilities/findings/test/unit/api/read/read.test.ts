import { describe, expect, it } from "vitest";
import { create } from "$findings/api/create/create";
import { read } from "$findings/api/read/read";
import { asCtx, asking, body, captured, refusalFrom } from "$findings/test/fixture";

describe("read", () => {
  it("returns the writeup and everything establishing it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, {
      title: "Margin fell on input costs",
      body: body("Supplier invoices are up 12%"),
      sources: [captured("Margin fell 4 points")]
    });

    const finding = await read(asCtx(ctx), scope, id);

    expect(finding).toMatchObject({
      id,
      title: "Margin fell on input costs",
      revision: 1,
      createdBy: { kind: "user", userId }
    });
    expect(finding.body).toHaveLength(1);
    expect(finding.sources[0]).toMatchObject({ excerpt: "Margin fell 4 points", capturedAt: 1_700_000_000_000 });
  });

  it("reports not found for a finding in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await create(asCtx(ctx), elsewhere, { title: "Their finding", body: [], sources: [] });

    // Not "forbidden": distinguishing them confirms the finding exists to
    // someone with no right to know that.
    expect(await refusalFrom(read(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
  });
});

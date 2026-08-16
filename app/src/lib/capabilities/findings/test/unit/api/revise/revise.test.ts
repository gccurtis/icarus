import { describe, expect, it } from "vitest";
import { create } from "$findings/api/create/create";
import { revise } from "$findings/api/revise/revise";
import { asCtx, asking, body, captured, refusalFrom } from "$findings/test/fixture";

describe("revise", () => {
  it("replaces the writeup and its citations, and moves the revision on", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, { title: "Margin fell", body: [], sources: [] });

    await revise(asCtx(ctx), scope, id, 1, {
      title: "Margin fell on input costs",
      body: body("Supplier invoices are up 12%"),
      sources: [captured("Margin fell 4 points")]
    });

    expect(ctx.rows.get(id)).toMatchObject({
      title: "Margin fell on input costs",
      revision: 2,
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.rows.get(id)?.sources).toHaveLength(1);
    expect(ctx.log.at(-1)).toMatchObject({ verb: "revised" });
  });

  it("keeps one row and writes no change set, because a finding has no history", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, { title: "Margin fell", body: body("First"), sources: [] });

    await revise(asCtx(ctx), scope, id, 1, { title: "Margin fell", body: body("Second"), sources: [] });

    // A citation records what it read, so keeping past versions here would mean a
    // full copy of the body per edit rather than one per actual dependency.
    const tables = [...ctx.rows.values()].map((row) => row._table);
    expect(tables.filter((table) => table === "findings")).toHaveLength(1);
    expect(tables).not.toContain("changeSets");
    expect(tables).not.toContain("resourceSnapshots");
  });

  it("rejects a write against a stale revision, changing nothing", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, { title: "Margin fell", body: [], sources: [] });
    await revise(asCtx(ctx), scope, id, 1, { title: "Someone got here first", body: [], sources: [] });

    // A writeup is edited in a form over an afternoon, which no transaction
    // covers. Rejection is the whole mechanism — the client is told it moved.
    expect(
      await refusalFrom(
        revise(asCtx(ctx), scope, id, 1, { title: "Saved over lunch", body: [], sources: [] })
      )
    ).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Someone got here first", revision: 2 });
  });

  it("reports not found for a finding in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await create(asCtx(ctx), elsewhere, { title: "Their finding", body: [], sources: [] });

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { title: "Mine now", body: [], sources: [] }))
    ).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Their finding" });
  });
});

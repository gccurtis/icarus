import { describe, expect, it } from "vitest";
import { assess } from "$hypotheses/api/assess/assess";
import { propose } from "$hypotheses/api/propose/propose";
import { revise } from "$hypotheses/api/revise/revise";
import { asCtx, asking, rationale, refusalFrom } from "$hypotheses/test/fixture";

describe("revise", () => {
  it("writes the claim and the argument, and moves the revision on", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    await revise(asCtx(ctx), scope, id, 1, {
      statement: "Input costs rose faster than prices",
      rationale: rationale("Supplier invoices are up 12%")
    });

    expect(ctx.rows.get(id)).toMatchObject({
      statement: "Input costs rose faster than prices",
      revision: 2,
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({ verb: "revised" });
  });

  it("leaves the judgement alone, because rewording is not reassessing", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });
    await assess(asCtx(ctx), scope, id, "supported", 0.8);

    await revise(asCtx(ctx), scope, id, 2, { statement: "Input costs rose", rationale: [] });

    expect(ctx.rows.get(id)).toMatchObject({ assessment: "supported", confidence: 0.8 });
  });

  it("rejects a write against a stale revision, changing nothing", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });
    await revise(asCtx(ctx), scope, id, 1, { statement: "Someone got here first", rationale: [] });

    // Rejection is the whole mechanism — no merging, no field-level
    // reconciliation. The client is told the hypothesis moved.
    expect(
      await refusalFrom(
        revise(asCtx(ctx), scope, id, 1, { statement: "Saved over lunch", rationale: [] })
      )
    ).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(id)).toMatchObject({
      statement: "Someone got here first",
      revision: 2
    });
  });

  it("reports not found for a hypothesis in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await propose(asCtx(ctx), elsewhere, { statement: "Their claim", rationale: [] });

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { statement: "Mine now", rationale: [] }))
    ).toMatchObject({ code: "not-found" });
    expect(ctx.rows.get(id)).toMatchObject({ statement: "Their claim" });
  });
});

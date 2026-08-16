import { describe, expect, it } from "vitest";
import { assess } from "$hypotheses/api/assess/assess";
import { list } from "$hypotheses/api/list/list";
import { propose } from "$hypotheses/api/propose/propose";
import { asCtx, asking, rationale } from "$hypotheses/test/fixture";

describe("list", () => {
  it("returns the caller's project and no other's", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await propose(asCtx(ctx), scope, {
      statement: "Input costs rose",
      rationale: rationale("Supplier invoices are up")
    });
    await propose(asCtx(ctx), elsewhere, { statement: "Their claim", rationale: [] });

    const found = await list(asCtx(ctx), scope);

    expect(found.map((hypothesis) => hypothesis.statement)).toEqual(["Input costs rose"]);
    expect(found[0]?.rationale).toHaveLength(1);
  });

  it("returns a hypothesis attached to no question", async () => {
    const { ctx, scope } = await asking();
    await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    // `projectId` is on the row rather than reached through a question, which is
    // what keeps an unattached hunch inside the project's own query.
    const found = await list(asCtx(ctx), scope);

    expect(found).toHaveLength(1);
    expect(found[0]?.confidence).toBeUndefined();
  });

  it("reports the assessment that was stored, never one counted from anything", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });
    await assess(asCtx(ctx), scope, id, "inconclusive", 0.4);

    const found = await list(asCtx(ctx), scope);

    // Three weak findings do not outweigh one decisive one, so the judgement is a
    // column and this is the only thing that could have written it.
    expect(found[0]).toMatchObject({ assessment: "inconclusive", confidence: 0.4 });
  });
});

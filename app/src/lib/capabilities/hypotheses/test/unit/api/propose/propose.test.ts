import { describe, expect, it } from "vitest";
import { propose } from "$hypotheses/api/propose/propose";
import { asCtx, asking, rationale, refusalFrom } from "$hypotheses/test/fixture";

describe("propose", () => {
  it("scopes what it creates to the caller's project, untested", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await propose(asCtx(ctx), scope, {
      statement: "  Input costs rose  ",
      rationale: rationale("Supplier invoices are up")
    });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      statement: "Input costs rose",
      assessment: "untested",
      revision: 1,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "proposed",
      target: { type: "hypothesis", id, label: "Input costs rose" }
    });
  });

  it("defaults no confidence, because there is nothing to be confident about yet", async () => {
    const { ctx, scope } = await asking();

    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    // Not 0, not 0.5 — a number nobody chose is one charts and summaries consume.
    expect(ctx.rows.get(id)).not.toHaveProperty("confidence");
  });

  it("attaches to no question, and is a legal row anyway", async () => {
    const { ctx, scope } = await asking();

    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    // A hunch arrives before the question it belongs to is articulated.
    expect(ctx.rows.get(id)).not.toHaveProperty("questionId");
  });

  it("refuses a hypothesis that claims nothing, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(propose(asCtx(ctx), scope, { statement: "   ", rationale: [] }))
    ).toMatchObject({ code: "empty-statement" });
    expect(ctx.log).toHaveLength(0);
  });
});

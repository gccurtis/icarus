import { describe, expect, it } from "vitest";
import { assess } from "$hypotheses/api/assess/assess";
import { propose } from "$hypotheses/api/propose/propose";
import { asCtx, asking, refusalFrom } from "$hypotheses/test/fixture";

describe("assess", () => {
  it("records the judgement and who made it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    await assess(asCtx(ctx), scope, id, "supported", 0.8);

    expect(ctx.rows.get(id)).toMatchObject({
      assessment: "supported",
      confidence: 0.8,
      revision: 2,
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({ verb: "assessed", detail: "supported" });
  });

  it("takes testing, so a thread running against a claim is visible as work", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    await assess(asCtx(ctx), scope, id, "testing");

    expect(ctx.rows.get(id)).toMatchObject({ assessment: "testing" });
  });

  it("takes inconclusive, which is a done outcome rather than a fresh start", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    await assess(asCtx(ctx), scope, id, "inconclusive");

    expect(ctx.rows.get(id)).toMatchObject({ assessment: "inconclusive" });
  });

  it("assesses without a confidence, and defaults none", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    await assess(asCtx(ctx), scope, id, "supported");

    expect(ctx.rows.get(id)?.confidence).toBeUndefined();
  });

  it("clears the number on the way back to untested", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });
    await assess(asCtx(ctx), scope, id, "supported", 0.8);

    await assess(asCtx(ctx), scope, id, "untested");

    // A confidence left behind would stand for a judgement that was withdrawn.
    expect(ctx.rows.get(id)?.confidence).toBeUndefined();
  });

  it("refuses a confidence on an untested claim, changing nothing", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    expect(await refusalFrom(assess(asCtx(ctx), scope, id, "untested", 0.8))).toMatchObject({
      code: "confidence-untested"
    });
    expect(ctx.rows.get(id)).toMatchObject({ revision: 1 });
  });

  it("refuses a confidence that is not a probability", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    expect(await refusalFrom(assess(asCtx(ctx), scope, id, "supported", 42))).toMatchObject({
      code: "confidence-range"
    });
  });

  it("reports not found for a hypothesis in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const id = await propose(asCtx(ctx), elsewhere, { statement: "Their claim", rationale: [] });

    expect(await refusalFrom(assess(asCtx(ctx), scope, id, "refuted"))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(id)).toMatchObject({ assessment: "untested" });
  });
});

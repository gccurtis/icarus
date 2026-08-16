import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { propose } from "$hypotheses/api/propose/propose";
import { requireHypothesis } from "$hypotheses/api/shared/require-hypothesis";
import { asCtx, asking, refusalFrom } from "$hypotheses/test/fixture";

describe("requireHypothesis", () => {
  it("returns the row when the hypothesis is in the caller's project", async () => {
    const { ctx, scope } = await asking();
    const id = await propose(asCtx(ctx), scope, { statement: "Input costs rose", rationale: [] });

    expect(await requireHypothesis(asCtx(ctx), scope, id)).toMatchObject({
      statement: "Input costs rose"
    });
  });

  it("answers a hypothesis in another project exactly as one that never existed", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await propose(asCtx(ctx), elsewhere, { statement: "Their claim", rationale: [] });
    const absent = "hypotheses:404" as Id<"hypotheses">;

    expect(await refusalFrom(requireHypothesis(asCtx(ctx), scope, theirs))).toMatchObject({
      code: "not-found"
    });
    expect(await refusalFrom(requireHypothesis(asCtx(ctx), scope, absent))).toMatchObject({
      code: "not-found"
    });
  });
});

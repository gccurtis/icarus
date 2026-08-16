import { describe, expect, it } from "vitest";
import { endpointIn } from "$research-links/api/shared/endpoint";
import { asCtx, asking, finding, hypothesis, question } from "$research-links/test/fixture";

describe("endpointIn", () => {
  it("labels each kind with the line a reader recognizes it by", async () => {
    const { ctx, scope } = await asking();
    const findingId = await finding(ctx, scope, "Margin fell on input costs");
    const hypothesisId = await hypothesis(ctx, scope, "Input costs drove it");
    const questionId = await question(ctx, scope, "Why did margin fall?");

    // The activity log freezes the label in, so it has to be the object's own
    // sentence rather than its id.
    expect(await endpointIn(asCtx(ctx), scope, "finding", findingId)).toEqual({
      id: findingId,
      label: "Margin fell on input costs"
    });
    expect(await endpointIn(asCtx(ctx), scope, "hypothesis", hypothesisId)).toEqual({
      id: hypothesisId,
      label: "Input costs drove it"
    });
    expect(await endpointIn(asCtx(ctx), scope, "question", questionId)).toEqual({
      id: questionId,
      label: "Why did margin fall?"
    });
  });

  it("finds nothing for a row in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await hypothesis(ctx, elsewhere, "Their hypothesis");

    // Returning null rather than throwing: the refusal is the caller's to word,
    // and both callers word it as "not found" rather than "forbidden".
    expect(await endpointIn(asCtx(ctx), scope, "hypothesis", theirs)).toBeNull();
  });

  it("finds nothing for an id the kind does not name a table for", async () => {
    const { ctx, scope } = await asking();
    const questionId = await question(ctx, scope, "Why did margin fall?");

    expect(await endpointIn(asCtx(ctx), scope, "finding", questionId)).toBeNull();
    expect(await endpointIn(asCtx(ctx), scope, "finding", "findings:404")).toBeNull();
  });
});

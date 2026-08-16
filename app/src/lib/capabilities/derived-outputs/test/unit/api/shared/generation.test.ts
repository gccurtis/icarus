import { describe, expect, it } from "vitest";
import { completeGeneration, failGeneration } from "$derived-outputs/api/shared/generation";
import { inputRevisions } from "$derived-outputs/api/shared/staleness";
import type { DerivedInput } from "$derived-outputs/types/derived-output";
import {
  asCtx,
  asking,
  editedTo,
  outputRow,
  paragraph,
  refusalFrom,
  resourceAt,
  stored
} from "$derived-outputs/test/fixture";

/** An output that has generated once, over one document at revision 1. */
const generated = async () => {
  const { ctx, scope, mine, theirs } = await asking();
  const input = await resourceAt(ctx, mine, "documents:1");
  await editedTo(ctx, mine, "documents:1", 1);
  const inputs: DerivedInput[] = [input];

  const id = await outputRow(ctx, mine, {
    inputs,
    inputsAt: await inputRevisions(asCtx(ctx), scope, inputs),
    block: paragraph("Revenue grew 12%."),
    state: "generating",
    refreshedAt: 1_699_000_000_000
  });

  return { ctx, scope, mine, theirs, id, inputs };
};

describe("completeGeneration", () => {
  it("stores the content and the revisions it was generated from", async () => {
    const { ctx, scope, mine, id } = await generated();
    await editedTo(ctx, mine, "documents:1", 2);

    await completeGeneration(asCtx(ctx), scope, id, { block: paragraph("Revenue grew 14%.") });

    expect(stored(ctx, id)).toMatchObject({
      state: "fresh",
      block: { display: "Revenue grew 14%." },
      // Read at completion rather than reported by the generator: what the
      // output claims to have seen is what the deployment can prove it saw.
      inputsAt: [{ kind: "resource", resourceId: "documents:1", revision: 2 }]
    });
  });

  it("dates the content, so a reader knows how old the facts are", async () => {
    const { ctx, scope, id } = await generated();

    await completeGeneration(asCtx(ctx), scope, id, { block: paragraph("Revenue grew 14%.") });

    expect(stored(ctx, id).refreshedAt).toBeGreaterThan(1_699_000_000_000);
  });

  it("records the model and the lattice the generator named", async () => {
    const { ctx, scope, id } = await generated();

    await completeGeneration(asCtx(ctx), scope, id, {
      block: paragraph("Revenue grew 14%."),
      model: "some-model-v2",
      latticeVersion: 7
    });

    expect(stored(ctx, id)).toMatchObject({ model: "some-model-v2", latticeVersion: 7 });
  });

  it("claims no model when the generator names none", async () => {
    const { ctx, scope, mine } = await asking();
    const id = await outputRow(ctx, mine, { state: "generating", model: "some-model-v1" });

    await completeGeneration(asCtx(ctx), scope, id, { block: paragraph("Revenue grew 14%.") });

    // The field says what produced the content it sits beside. Inheriting the
    // last generation's would attribute this one to a model that never ran it.
    expect(stored(ctx, id).model).toBeUndefined();
  });

  it("clears the error a previous attempt left", async () => {
    const { ctx, scope, id } = await generated();
    await failGeneration(asCtx(ctx), scope, id, "the provider timed out");

    await completeGeneration(asCtx(ctx), scope, id, { block: paragraph("Revenue grew 14%.") });

    expect(stored(ctx, id).error).toBeUndefined();
    expect(stored(ctx, id).state).toBe("fresh");
  });

  it("refuses a generation that produced several blocks, and stores none of them", async () => {
    const { ctx, scope, id } = await generated();
    const before = stored(ctx, id).block;

    const refusal = await refusalFrom(
      completeGeneration(asCtx(ctx), scope, id, {
        block: [paragraph("First."), paragraph("Second.")]
      })
    );

    expect(refusal).toMatchObject({ code: "block-list" });
    expect(stored(ctx, id).block).toEqual(before);
  });

  it("reports not found for an output in another project", async () => {
    const { ctx, scope, theirs } = await asking();
    const id = await outputRow(ctx, theirs);

    expect(
      await refusalFrom(
        completeGeneration(asCtx(ctx), scope, id, { block: paragraph("Not yours.") })
      )
    ).toMatchObject({ code: "not-found" });
  });
});

/**
 * **The most important behaviour in this capability.** An output that emptied
 * itself on a failed refresh would turn a transient provider outage into a hole
 * in someone's report.
 */
describe("failGeneration", () => {
  it("leaves the content, its provenance, and its date exactly as they were", async () => {
    const { ctx, scope, id } = await generated();
    const before = stored(ctx, id);
    const { block, inputsAt, refreshedAt } = before;

    await failGeneration(asCtx(ctx), scope, id, "the provider timed out");

    expect(stored(ctx, id)).toMatchObject({ block, inputsAt, refreshedAt });
  });

  it("says the attempt failed and why, so what is shown can be marked", async () => {
    const { ctx, scope, id } = await generated();

    await failGeneration(asCtx(ctx), scope, id, "the provider timed out");

    expect(stored(ctx, id)).toMatchObject({
      state: "error",
      error: "the provider timed out"
    });
  });

  it("moves the row's own timestamp, which is not the content's", async () => {
    const { ctx, scope, id } = await generated();

    await failGeneration(asCtx(ctx), scope, id, "the provider timed out");

    // `updatedAt` says when the row last moved; `refreshedAt` says when this
    // content was generated. A failure moves one and not the other.
    expect(stored(ctx, id).updatedAt).toBeGreaterThan(stored(ctx, id).refreshedAt as number);
  });

  it("leaves an output that never generated showing its empty block", async () => {
    const { ctx, scope, mine } = await asking();
    const id = await outputRow(ctx, mine, { state: "generating" });
    const before = stored(ctx, id).block;

    await failGeneration(asCtx(ctx), scope, id, "the provider timed out");

    expect(stored(ctx, id)).toMatchObject({ block: before, state: "error" });
    expect(stored(ctx, id).refreshedAt).toBeUndefined();
  });

  it("reports not found for an output in another project", async () => {
    const { ctx, scope, theirs } = await asking();
    const id = await outputRow(ctx, theirs);

    expect(await refusalFrom(failGeneration(asCtx(ctx), scope, id, "nope"))).toMatchObject({
      code: "not-found"
    });
  });
});

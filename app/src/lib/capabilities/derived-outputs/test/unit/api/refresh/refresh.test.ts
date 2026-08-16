import { describe, expect, it } from "vitest";
import { refresh } from "$derived-outputs/api/refresh/refresh";
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

/** An output showing content somebody has since reworded in their document. */
const generated = async () => {
  const { ctx, scope, mine, theirs } = await asking();
  const input = await resourceAt(ctx, mine, "documents:1");
  await editedTo(ctx, mine, "documents:1", 1);

  const id = await outputRow(ctx, mine, {
    prompt: "Summarize the pricing findings",
    inputs: [input],
    inputsAt: await inputRevisions(asCtx(ctx), scope, [input]),
    block: paragraph("Revenue grew 12%."),
    state: "fresh",
    refreshedAt: 1_699_000_000_000
  });

  return { ctx, scope, mine, theirs, id, input };
};

describe("refresh", () => {
  it("puts the output in generating and leaves its content standing", async () => {
    const { ctx, scope, id } = await generated();
    const before = stored(ctx, id).block;

    await refresh(asCtx(ctx), scope, id);

    // Nothing is cleared while a generation runs: the reader keeps seeing the
    // last good content, marked as being worked on.
    expect(stored(ctx, id)).toMatchObject({ state: "generating", block: before });
  });

  it("hands the generator the prompt and the declared inputs", async () => {
    const { ctx, scope, id, input } = await generated();

    expect(await refresh(asCtx(ctx), scope, id)).toMatchObject({
      outputId: id,
      prompt: "Summarize the pricing findings",
      inputs: [input]
    });
  });

  it("carries the presented copy to the generator as the shape to preserve", async () => {
    const { ctx, scope, id } = await generated();
    const edited = paragraph("Revenue was up sharply — 12% on the quarter.", "b7");

    const request = await refresh(asCtx(ctx), scope, id, edited);

    // The next refresh updates the facts without discarding the phrasing
    // somebody chose, which is only possible if their text goes to the generator.
    expect(request.shaping).toEqual(edited);
  });

  it("does not write the presented copy back to the output", async () => {
    const { ctx, scope, id } = await generated();
    const before = stored(ctx, id).block;

    await refresh(asCtx(ctx), scope, id, paragraph("Revenue was up sharply.", "b7"));

    // Two copies, deliberately: the output keeps the canonical generated version
    // and the block keeps the presented one, because they answer different
    // questions. Writing the edit back here would lose the first.
    expect(stored(ctx, id).block).toEqual(before);
  });

  it("clears the error from the attempt it is replacing", async () => {
    const { ctx, scope, mine } = await asking();
    const id = await outputRow(ctx, mine, {
      block: paragraph("Revenue grew 12%."),
      state: "error",
      error: "the provider timed out"
    });

    await refresh(asCtx(ctx), scope, id);

    expect(stored(ctx, id).error).toBeUndefined();
    expect(stored(ctx, id).state).toBe("generating");
  });

  it("refreshes an output whose inputs are only a lattice query", async () => {
    const { ctx, scope, mine } = await asking();
    const inputs: DerivedInput[] = [{ kind: "lattice", query: "pricing" }];
    const id = await outputRow(ctx, mine, { inputs, state: "fresh" });

    // Nothing signals a lattice-only output to refresh, so asking is the whole
    // mechanism it has.
    expect(await refresh(asCtx(ctx), scope, id)).toMatchObject({ inputs });
  });

  it("reports not found for an output in another project", async () => {
    const { ctx, scope, theirs } = await asking();
    const id = await outputRow(ctx, theirs);

    expect(await refusalFrom(refresh(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
  });
});

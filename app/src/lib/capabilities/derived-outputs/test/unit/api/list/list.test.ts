import { describe, expect, it } from "vitest";
import { list } from "$derived-outputs/api/list/list";
import { inputRevisions } from "$derived-outputs/api/shared/staleness";
import type { DerivedInput } from "$derived-outputs/types/derived-output";
import {
  asCtx,
  asking,
  editedTo,
  outputRow,
  paragraph,
  resourceAt
} from "$derived-outputs/test/fixture";

describe("list", () => {
  it("returns the caller's project's outputs and no others", async () => {
    const { ctx, scope, mine, theirs } = await asking();
    await outputRow(ctx, mine, { prompt: "Summarize the pricing findings" });
    await outputRow(ctx, theirs, { prompt: "Somebody else's summary" });

    expect((await list(asCtx(ctx), scope)).map((output) => output.prompt)).toEqual([
      "Summarize the pricing findings"
    ]);
  });

  it("leaves the content out, and says how much each is derived from", async () => {
    const { ctx, scope, mine } = await asking();
    const inputs: DerivedInput[] = [
      { kind: "lattice", query: "pricing" },
      { kind: "lattice", query: "renewals" }
    ];
    await outputRow(ctx, mine, { inputs, block: paragraph("Revenue grew 12%.") });

    // A directory of outputs is where "which of these need refreshing" is asked,
    // and the content is read through the prompt block presenting it.
    const [summary] = await list(asCtx(ctx), scope);
    expect(summary).not.toHaveProperty("block");
    expect(summary.inputCount).toBe(2);
  });

  it("marks the stale ones, which is what a directory of them is for", async () => {
    const { ctx, scope, mine } = await asking();
    const input = await resourceAt(ctx, mine, "documents:1");
    await editedTo(ctx, mine, "documents:1", 1);
    const inputsAt = await inputRevisions(asCtx(ctx), scope, [input]);
    await outputRow(ctx, mine, { inputs: [input], inputsAt, state: "fresh" });
    await outputRow(ctx, mine, { state: "fresh", prompt: "Nothing declared" });

    await editedTo(ctx, mine, "documents:1", 2);

    expect((await list(asCtx(ctx), scope)).map((output) => output.state)).toEqual([
      "stale",
      "fresh"
    ]);
  });
});

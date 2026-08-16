import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { requireOutput } from "$derived-outputs/api/shared/require-output";
import { asCtx, asking, outputRow, refusalFrom } from "$derived-outputs/test/fixture";

describe("requireOutput", () => {
  it("returns the stored row, which is what a refresh patches", async () => {
    const { ctx, scope, mine } = await asking();
    const id = await outputRow(ctx, mine, { prompt: "Summarize the pricing findings" });

    expect(await requireOutput(asCtx(ctx), scope, id)).toMatchObject({
      prompt: "Summarize the pricing findings",
      state: "idle"
    });
  });

  it("answers for another project's output exactly as for one that never existed", async () => {
    const { ctx, scope, theirs } = await asking();
    const theirOutput = await outputRow(ctx, theirs);

    const absent = await refusalFrom(
      requireOutput(asCtx(ctx), scope, "derivedOutputs:404" as Id<"derivedOutputs">)
    );
    const elsewhere = await refusalFrom(requireOutput(asCtx(ctx), scope, theirOutput));

    // Telling them apart confirms that somebody else's generated content exists.
    expect(elsewhere?.code).toBe("not-found");
    expect(absent?.code).toBe("not-found");
  });
});

import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { ask } from "$questions/api/ask/ask";
import { requireQuestion } from "$questions/api/shared/require-question";
import { asCtx, asking, refusalFrom } from "$questions/test/fixture";

describe("requireQuestion", () => {
  it("returns the row when the question is in the caller's project", async () => {
    const { ctx, scope } = await asking();
    const id = await ask(asCtx(ctx), scope, { text: "Why did margin fall?", notes: [] });

    expect(await requireQuestion(asCtx(ctx), scope, id)).toMatchObject({
      text: "Why did margin fall?"
    });
  });

  it("answers a question in another project exactly as one that never existed", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = await ask(asCtx(ctx), elsewhere, { text: "Their question", notes: [] });
    const absent = "questions:404" as Id<"questions">;

    expect(await refusalFrom(requireQuestion(asCtx(ctx), scope, theirs))).toMatchObject({
      code: "not-found"
    });
    expect(await refusalFrom(requireQuestion(asCtx(ctx), scope, absent))).toMatchObject({
      code: "not-found"
    });
  });
});

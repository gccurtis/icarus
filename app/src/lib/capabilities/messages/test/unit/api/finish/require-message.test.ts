import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { requireMessage } from "$messages/api/finish/require-message";
import { post } from "$messages/api/post/post";
import { asCtx, asking, refusalFrom, research, said } from "$messages/test/fixture";

describe("requireMessage", () => {
  it("returns a turn in the caller's project", async () => {
    const { ctx, scope, person } = await asking();
    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "prompt",
      blocks: said("Ours"),
      author: person
    });

    expect((await requireMessage(asCtx(ctx), scope, id))._id).toBe(id);
  });

  it("answers a turn in another project exactly as one that never existed", async () => {
    const { ctx, scope, elsewhere, person } = await asking();
    const id = await post(asCtx(ctx), scope, {
      thread: research("researchThreads:1"),
      role: "prompt",
      blocks: said("Ours"),
      author: person
    });

    // The gate proved the caller holds *a* project; this proves the row is in it.
    const mine = await refusalFrom(requireMessage(asCtx(ctx), elsewhere, id));
    const absent = await refusalFrom(
      requireMessage(asCtx(ctx), elsewhere, "messages:404" as Id<"messages">)
    );

    expect(mine?.code).toBe("not-found");
    expect(absent?.code).toBe("not-found");
  });
});

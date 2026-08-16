import { describe, expect, it } from "vitest";
import { requireThread } from "$persona-threads/api/shared/require-thread";
import { asCtx, chatting, refusalFrom, threadIn } from "$persona-threads/test/fixture";

describe("requireThread", () => {
  it("returns the row when the thread is in the caller's project", async () => {
    const { ctx, scope, persona } = await chatting();
    const id = await threadIn(ctx, scope.projectId, persona, "Q3 margin");

    expect((await requireThread(asCtx(ctx), scope, id)).title).toBe("Q3 margin");
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere, theirPersona } = await chatting();
    const id = await threadIn(ctx, elsewhere.projectId, theirPersona, "Theirs");

    // Not "forbidden": telling absence and someone else's apart confirms that a
    // conversation with somebody is happening.
    expect(await refusalFrom(requireThread(asCtx(ctx), scope, id))).toMatchObject({
      code: "not-found"
    });
  });
});

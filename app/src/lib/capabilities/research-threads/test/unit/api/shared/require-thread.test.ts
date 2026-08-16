import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { requireThread } from "$research-threads/api/shared/require-thread";
import { start } from "$research-threads/api/start/start";
import { asCtx, refusalFrom, researching } from "$research-threads/test/fixture";

describe("requireThread", () => {
  it("returns the stored row its callers are about to patch or read", async () => {
    const { ctx, scope } = await researching();
    const id = await start(asCtx(ctx), scope, { title: "Wandering", mode: "discover" });

    expect(await requireThread(asCtx(ctx), scope, id)).toMatchObject({
      projectId: scope.projectId,
      title: "Wandering",
      revision: 1
    });
  });

  it("reports not found for a thread in another project", async () => {
    const { ctx, scope, elsewhere } = await researching();
    const id = await start(asCtx(ctx), elsewhere, { title: "Theirs", mode: "discover" });

    // Telling absence and someone else's apart confirms that a conversation
    // about something is happening.
    expect(await refusalFrom(requireThread(asCtx(ctx), scope, id))).toMatchObject({
      code: "not-found"
    });
  });

  it("reports not found for a thread that never existed", async () => {
    const { ctx, scope } = await researching();

    expect(
      await refusalFrom(
        requireThread(asCtx(ctx), scope, "researchThreads:404" as Id<"researchThreads">)
      )
    ).toMatchObject({ code: "not-found" });
  });
});

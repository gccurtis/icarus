import { describe, expect, it } from "vitest";
import { requireBranchPoint } from "$agent-tasks/api/dispatch/require-branch-point";
import { asCtx, dispatching, refusalFrom, saidIn } from "$agent-tasks/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

describe("requireBranchPoint", () => {
  it("accepts a message that is a turn of the thread named", async () => {
    const { ctx, scope, threadId, messageId } = await dispatching();

    await requireBranchPoint(asCtx(ctx), scope, { threadId, messageId });
  });

  it("refuses a message from another conversation", async () => {
    const { ctx, scope, threadId, persona } = await dispatching();
    const other = (await ctx.db.insert("personaThreads", {
      projectId: scope.projectId,
      personaId: persona,
      title: "Something else",
      createdBy: { kind: "system" },
      updatedAt: 1
    })) as Id<"personaThreads">;
    const elsewhere = await saidIn(ctx, scope.projectId, other);

    // The pair has to agree, or the task claims to continue from a turn nobody
    // can reach by reading the thread it says it came from.
    expect(
      await refusalFrom(requireBranchPoint(asCtx(ctx), scope, { threadId, messageId: elsewhere }))
    ).toMatchObject({ code: "not-found" });
  });

  it("refuses a message in another project", async () => {
    const { ctx, scope, elsewhere, threadId } = await dispatching();
    const theirs = await saidIn(ctx, elsewhere.projectId, threadId);

    expect(
      await refusalFrom(requireBranchPoint(asCtx(ctx), scope, { threadId, messageId: theirs }))
    ).toMatchObject({ code: "not-found" });
  });

  it("refuses a message that never existed", async () => {
    const { ctx, scope, threadId } = await dispatching();

    expect(
      await refusalFrom(
        requireBranchPoint(asCtx(ctx), scope, {
          threadId,
          messageId: "messages:404" as Id<"messages">
        })
      )
    ).toMatchObject({ code: "not-found" });
  });
});

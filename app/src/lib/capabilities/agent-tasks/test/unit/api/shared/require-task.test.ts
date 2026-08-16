import { describe, expect, it } from "vitest";
import { requireTask } from "$agent-tasks/api/shared/require-task";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";
import type { Id } from "$convex/_generated/dataModel";

describe("requireTask", () => {
  it("returns the row a task id names in the caller's project", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId);

    expect(await requireTask(asCtx(ctx), scope, id)).toMatchObject({ _id: id, status: "draft" });
  });

  it("reports not found for a task in another project", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId);

    // Not "forbidden": telling absence and somebody else's apart confirms that
    // work is being done somewhere the caller cannot see.
    expect(await refusalFrom(requireTask(asCtx(ctx), scope, theirs))).toMatchObject({
      capability: "agentTasks",
      code: "not-found"
    });
  });

  it("reports not found for a task that never existed", async () => {
    const { ctx, scope } = await dispatching();

    expect(
      await refusalFrom(requireTask(asCtx(ctx), scope, "agentTasks:404" as Id<"agentTasks">))
    ).toMatchObject({ code: "not-found" });
  });
});

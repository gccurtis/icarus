import { describe, expect, it } from "vitest";
import { requireOrigin } from "$agent-tasks/api/dispatch/require-origin";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";
import { taskActor } from "$agent-tasks/types/agent-task";

describe("requireOrigin", () => {
  it("passes an origin naming no task through untouched", async () => {
    const { ctx, scope, userId } = await dispatching();

    await requireOrigin(asCtx(ctx), scope, { kind: "user", userId });
    await requireOrigin(asCtx(ctx), scope, { kind: "system" });
  });

  it("accepts a parent task the caller can see", async () => {
    const { ctx, scope } = await dispatching();
    const parent = await taskIn(ctx, scope.projectId, { status: "running" });

    await requireOrigin(asCtx(ctx), scope, taskActor(parent));
  });

  it("reports not found for a parent in another project", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId);

    // Delegation is only traceable if the parent is real and reachable: an
    // origin naming a task nobody here can read is a tree with no root.
    expect(await refusalFrom(requireOrigin(asCtx(ctx), scope, taskActor(theirs)))).toMatchObject({
      code: "not-found"
    });
  });
});

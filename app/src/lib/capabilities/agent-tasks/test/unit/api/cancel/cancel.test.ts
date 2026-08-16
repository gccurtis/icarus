import { describe, expect, it } from "vitest";
import { cancel } from "$agent-tasks/api/cancel/cancel";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";

describe("cancel", () => {
  it("stops a running task and dates the stop", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running", startedAt: 1 });

    await cancel(asCtx(ctx), scope, id);

    expect(ctx.rows.get(id)).toMatchObject({ status: "cancelled", startedAt: 1 });
    expect(ctx.rows.get(id)?.finishedAt).toBeTypeOf("number");
  });

  it("records no error, because stopping a task is not one", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "waiting" });

    await cancel(asCtx(ctx), scope, id);

    // `cancelled` is a separate state from `failed` for exactly this reason:
    // merging them makes a failure rate a measure of how often people change
    // their minds.
    expect(ctx.rows.get(id)?.error).toBeUndefined();
  });

  it("is the person's act, not the task's", async () => {
    const { ctx, scope, userId } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running" });

    await cancel(asCtx(ctx), scope, id);

    expect(ctx.log.at(-1)).toMatchObject({
      actor: { kind: "user", userId },
      verb: "cancelled",
      target: { type: "agentTask", id, label: "Q3 competitive scan" }
    });
  });

  it("refuses a task that already stopped, and leaves how it stopped alone", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "complete" });

    expect(await refusalFrom(cancel(asCtx(ctx), scope, id))).toMatchObject({
      code: "already-finished"
    });
    expect(ctx.rows.get(id)).toMatchObject({ status: "complete" });
  });

  it("reports not found for a task in another project", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId, { status: "running" });

    expect(await refusalFrom(cancel(asCtx(ctx), scope, theirs))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(theirs)).toMatchObject({ status: "running" });
  });
});

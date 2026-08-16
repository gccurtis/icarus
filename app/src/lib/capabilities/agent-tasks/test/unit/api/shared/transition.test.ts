import { describe, expect, it } from "vitest";
import { moveTo } from "$agent-tasks/api/shared/transition";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";
import type { AgentTaskStatus } from "$agent-tasks/types/agent-task";
import type { Doc } from "$convex/_generated/dataModel";

const from = async (status: AgentTaskStatus) => {
  const { ctx, scope } = await dispatching();
  const id = await taskIn(ctx, scope.projectId, { status });
  return { ctx, id, task: (await asCtx(ctx).db.get(id)) as Doc<"agentTasks"> };
};

describe("moveTo", () => {
  it("writes the new status and stamps the row as moved", async () => {
    const { ctx, id, task } = await from("draft");

    await moveTo(asCtx(ctx), task, "running", { startedAt: 42 });

    expect(ctx.rows.get(id)).toMatchObject({ status: "running", startedAt: 42 });
    expect(ctx.rows.get(id)?.updatedAt).not.toBe(task.updatedAt);
  });

  it("lets a running task wait and a waiting task run again", async () => {
    // The two are distinct states with a way back, because a task blocked on a
    // person is one somebody answers rather than one somebody restarts.
    const waiting = await from("running");
    await moveTo(asCtx(waiting.ctx), waiting.task, "waiting");
    expect(waiting.ctx.rows.get(waiting.id)).toMatchObject({ status: "waiting" });

    const resumed = await from("waiting");
    await moveTo(asCtx(resumed.ctx), resumed.task, "running");
    expect(resumed.ctx.rows.get(resumed.id)).toMatchObject({ status: "running" });
  });

  it("refuses to move a task that has already stopped", async () => {
    for (const status of ["complete", "failed", "cancelled"] as const) {
      const { ctx, id, task } = await from(status);

      expect(await refusalFrom(moveTo(asCtx(ctx), task, "running"))).toMatchObject({
        code: "already-finished"
      });
      expect(ctx.rows.get(id)).toMatchObject({ status });
    }
  });

  it("keeps cancelling and failing apart, and lets neither become the other", async () => {
    // Somebody stopping a task is not an error. Merging the two makes a failure
    // rate a measure of how often people change their minds.
    const cancelled = await from("cancelled");
    expect(await refusalFrom(moveTo(asCtx(cancelled.ctx), cancelled.task, "failed"))).toMatchObject({
      code: "already-finished"
    });

    const failed = await from("failed");
    expect(await refusalFrom(moveTo(asCtx(failed.ctx), failed.task, "cancelled"))).toMatchObject({
      code: "already-finished"
    });
  });

  it("refuses a move the lifecycle does not have", async () => {
    const { ctx, id, task } = await from("running");

    expect(await refusalFrom(moveTo(asCtx(ctx), task, "running"))).toMatchObject({
      code: "bad-transition"
    });
    // A draft task has not run, so there is nothing to have produced a result.
    const draft = await from("draft");
    expect(await refusalFrom(moveTo(asCtx(draft.ctx), draft.task, "complete"))).toMatchObject({
      code: "bad-transition"
    });
    expect(ctx.rows.get(id)).toMatchObject({ status: "running" });
  });

  it("lets a task be cancelled from every state it has not stopped in", async () => {
    for (const status of ["draft", "running", "waiting"] as const) {
      const { ctx, id, task } = await from(status);

      await moveTo(asCtx(ctx), task, "cancelled");

      expect(ctx.rows.get(id)).toMatchObject({ status: "cancelled" });
    }
  });
});

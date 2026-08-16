import { describe, expect, it } from "vitest";
import { asSummary, asTask } from "$agent-tasks/api/shared/as-task";
import { asCtx, dispatching, taskIn } from "$agent-tasks/test/fixture";
import type { Doc } from "$convex/_generated/dataModel";

const rowOf = async () => {
  const { ctx, scope, persona, userId } = await dispatching();
  const id = await taskIn(ctx, scope.projectId, {
    status: "running",
    personaId: persona,
    origin: { kind: "user", userId }
  });
  const row = (await asCtx(ctx).db.get(id)) as Doc<"agentTasks">;
  return { row, id, scope };
};

describe("asTask", () => {
  it("drops projectId and carries the row's creation time", async () => {
    const { row, id } = await rowOf();

    const task = asTask(row);

    expect(task).not.toHaveProperty("projectId");
    expect(task.id).toBe(id);
    // Three moments: `_creationTime` is when the task came into existence,
    // `startedAt` when it began, `finishedAt` when it stopped.
    expect(task.createdAt).toBe(row._creationTime);
    expect(task.startedAt).toBeUndefined();
  });

  it("keeps the prompt, because provenance is what the task page shows", async () => {
    const { row } = await rowOf();

    expect(asTask(row).prompt).toBe(row.prompt);
  });
});

describe("asSummary", () => {
  it("leaves the prompt, the plan, and the deliverable behind", async () => {
    const { row } = await rowOf();

    const summary = asSummary({ ...row, plan: [{ description: "Read", status: "done" }] });

    expect(summary).not.toHaveProperty("prompt");
    expect(summary).not.toHaveProperty("plan");
    expect(summary).not.toHaveProperty("result");
    expect(summary).toMatchObject({ title: row.title, status: "running" });
  });
});

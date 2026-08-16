import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireTask } from "$agent-tasks/api/shared/require-task";
import { moveTo } from "$agent-tasks/api/shared/transition";
import { AgentTasksError } from "$agent-tasks/errors";
import { hasFinished, taskActor, type PlanStep } from "$agent-tasks/types/agent-task";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";

/**
 * Marks a task as picked up, and dates the moment it began.
 *
 * **`startedAt` is stamped once.** A task answered after an hour of `waiting`
 * began when it began; restamping on every resume would make the gap between
 * creation and start — the only measure of how long work sat queued —
 * unreadable.
 */
export const startRun = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">
): Promise<void> => {
  const task = await requireTask(ctx, scope, id);

  await moveTo(ctx, task, "running", task.startedAt === undefined ? { startedAt: Date.now() } : {});
};

/**
 * Parks a task on somebody's answer.
 *
 * **Nothing is dated, because nothing has ended.** A blocked task consumes no
 * model and no tool, and it is still work in progress — which is exactly why it
 * is not `running` and not one of the three ways a task stops.
 */
export const waitForInput = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">
): Promise<void> => {
  await moveTo(ctx, await requireTask(ctx, scope, id), "waiting");
};

/**
 * Replaces what the agent says it will do.
 *
 * **Wholesale, and no history.** The plan is a checklist rather than a graph,
 * and it is allowed to be wrong: an agent that learns better rewrites the list.
 * Keeping the previous ones would be keeping a record of intentions nobody acts
 * on, and neither the agent nor a reader ever looks back at them.
 *
 * The status is untouched — revising a plan is not progress through it.
 */
export const setPlan = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">,
  plan: PlanStep[]
): Promise<void> => {
  const task = await requireTask(ctx, scope, id);
  if (hasFinished(task.status)) {
    throw new AgentTasksError("already-finished", `Task ${id} has already ${task.status}`);
  }

  await ctx.db.patch(id, { plan, updatedAt: Date.now() });
};

/**
 * Records that the work is done, and what it produced.
 *
 * **The result is blocks because the output is content** — a written answer, a
 * table, a chart, a draft. It is the deliverable, extracted so nobody has to read
 * the whole thread to find it.
 *
 * **The activity entry's actor is the task**, which is what a person reads as
 * *Researcher · Gabriel Curtis · Q3 competitive scan*: the persona, the person
 * who asked, and this task's own title.
 */
export const completeTask = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">,
  result: ContentBlock[]
): Promise<void> => {
  const task = await requireTask(ctx, scope, id);

  await moveTo(ctx, task, "complete", { result, finishedAt: Date.now() });

  await record(ctx, scope, {
    actor: taskActor(id),
    verb: "completed",
    target: { type: "agentTask", id, label: task.title }
  });
};

/**
 * Records that the work stopped because something went wrong.
 *
 * Separate from [`cancel`](../cancel/cancel.ts) in state and in actor: this one
 * is the run's own report of an error, and it is the state a failure rate counts.
 * Whatever the task got as far as is left alone.
 */
export const failTask = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">,
  reason: string
): Promise<void> => {
  const task = await requireTask(ctx, scope, id);

  await moveTo(ctx, task, "failed", { error: reason, finishedAt: Date.now() });

  await record(ctx, scope, {
    actor: taskActor(id),
    verb: "failed",
    target: { type: "agentTask", id, label: task.title },
    detail: reason
  });
};

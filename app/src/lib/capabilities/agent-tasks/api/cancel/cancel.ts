import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireTask } from "$agent-tasks/api/shared/require-task";
import { moveTo } from "$agent-tasks/api/shared/transition";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";

/**
 * Stops a task somebody no longer wants finished.
 *
 * **It writes no `error`, and that is the whole point of `cancelled` being its
 * own state.** Somebody changing their mind is not a failure, and folding the
 * two together makes a failure rate a measure of how often people do.
 *
 * **The actor is the person, not the task.** Every other end to a run is the
 * task's own act; this one is done to it, and a feed that said the agent
 * cancelled itself would hide who actually stopped it.
 *
 * The result and the plan are left as they stand. A task cancelled halfway
 * through did the work it did, and erasing that would remove the only record of
 * what it got as far as.
 */
export const cancel = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"agentTasks">
): Promise<void> => {
  const task = await requireTask(ctx, scope, id);
  const by: Actor = { kind: "user", userId: scope.userId };

  await moveTo(ctx, task, "cancelled", { finishedAt: Date.now() });

  await record(ctx, scope, {
    actor: by,
    verb: "cancelled",
    target: { type: "agentTask", id, label: task.title }
  });
};

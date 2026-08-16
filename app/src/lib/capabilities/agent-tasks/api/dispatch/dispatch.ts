import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireBranchPoint } from "$agent-tasks/api/dispatch/require-branch-point";
import { requireOrigin } from "$agent-tasks/api/dispatch/require-origin";
import { taskPrompt, taskTitle, type TaskDispatch } from "$agent-tasks/types/agent-task";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requirePersona } from "$personas/api/shared/require-persona";
import type { Actor } from "$shared/types/actor";

/**
 * Hands a goal to an agent, and returns the task's id.
 *
 * **The row it writes is the thread.** Nothing is created beside it — messages
 * name this id, and the first turn can be posted the moment this returns.
 *
 * **`origin` is a parameter, not an argument.** The door builds the caller's own
 * actor from `ctx.scope`, so a browser cannot sign somebody else's name to a
 * task; a running task delegating work calls this directly with its own, and the
 * child then records the parent rather than the person at the top of the tree.
 *
 * **It comes into existence in `draft`.** `_creationTime` says when that
 * happened and `startedAt` says when a runner picked it up, because a queued task
 * and a running one are not the same thing.
 */
export const dispatch = async (
  ctx: MutationCtx,
  scope: Scope,
  origin: Actor,
  input: TaskDispatch
): Promise<Id<"agentTasks">> => {
  const title = taskTitle(input.title);
  const prompt = taskPrompt(input.prompt);
  await requireOrigin(ctx, scope, origin);
  if (input.personaId) await requirePersona(ctx, scope, input.personaId);
  if (input.branchedFrom) await requireBranchPoint(ctx, scope, input.branchedFrom);

  const id = await ctx.db.insert("agentTasks", {
    projectId: scope.projectId,
    title,
    prompt,
    description: input.description,
    personaId: input.personaId,
    branchedFrom: input.branchedFrom,
    status: "draft",
    origin,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: origin,
    verb: "dispatched",
    target: { type: "agentTask", id, label: title }
  });

  return id;
};

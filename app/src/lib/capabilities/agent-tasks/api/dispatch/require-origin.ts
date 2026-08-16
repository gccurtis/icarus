import type { Scope } from "$access/types/access";
import { requireTask } from "$agent-tasks/api/shared/require-task";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";

/**
 * Proves an origin naming a task names one the caller can see.
 *
 * **Delegation is only traceable if the parent is real.** An `agent` origin's
 * `taskId` is the task that dispatched this one, which is what gives a tree of
 * work a root and makes a runaway loop visible as depth — an unchecked one would
 * let a task hang its children off an id from anywhere, or from nowhere.
 *
 * Every other kind names nothing this capability can resolve, and passes.
 */
export const requireOrigin = async (
  ctx: QueryCtx,
  scope: Scope,
  origin: Actor
): Promise<void> => {
  // The cast goes away with the actor union's own `v.id("agentTasks")`.
  if (origin.kind === "agent") await requireTask(ctx, scope, origin.taskId as Id<"agentTasks">);
};

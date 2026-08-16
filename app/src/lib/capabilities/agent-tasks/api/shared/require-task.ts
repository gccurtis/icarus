import type { Scope } from "$access/types/access";
import { AgentTasksError } from "$agent-tasks/errors";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * The task that id names, or a refusal — what every function taking a task id
 * starts with, including the one checking a parent.
 *
 * **Not found, never forbidden.** A task in another project answers exactly as
 * one that never existed; telling them apart confirms that work is being done
 * somewhere the caller cannot see.
 *
 * **The project is the whole check.** Any member may read any task: an agent's
 * work is project content, and the reason a task exists is usually a
 * conversation everybody can already read.
 */
export const requireTask = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"agentTasks">
): Promise<Doc<"agentTasks">> => {
  const task = await ctx.db.get(id);
  if (!task || task.projectId !== scope.projectId) {
    throw new AgentTasksError("not-found", `Task not found: ${id}`);
  }
  return task;
};

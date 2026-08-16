import type { Scope } from "$access/types/access";
import { asSummary } from "$agent-tasks/api/shared/as-task";
import type { AgentTaskStatus, AgentTaskSummary } from "$agent-tasks/types/agent-task";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/** Which tasks. Both absent is the project's whole list. */
export type TaskFilter = {
  readonly status?: AgentTaskStatus;
  readonly personaId?: Id<"personas">;
};

/**
 * The project's tasks, narrowed by status or persona.
 *
 * **Each narrowing is one indexed range**, which is why the two indexes exist:
 * `by_project_status` answers "what is running" — the question a person asks
 * about work they are waiting on — and `by_persona` answers "what has this one
 * done". Asked together, the index does the coarser half and the finer half is a
 * predicate over what came back, because a third index would earn nothing over
 * the size either range has.
 *
 * Summaries, so a directory of tasks does not carry every deliverable's blocks
 * to answer the cheapest question in the capability.
 */
export const list = async (
  ctx: QueryCtx,
  scope: Scope,
  filter: TaskFilter = {}
): Promise<AgentTaskSummary[]> => {
  const rows = filter.personaId
    ? await ctx.db
        .query("agentTasks")
        .withIndex("by_persona", (q) =>
          q.eq("projectId", scope.projectId).eq("personaId", filter.personaId)
        )
        .collect()
    : await ctx.db
        .query("agentTasks")
        .withIndex("by_project_status", (q) =>
          filter.status === undefined
            ? q.eq("projectId", scope.projectId)
            : q.eq("projectId", scope.projectId).eq("status", filter.status)
        )
        .collect();

  return rows
    .filter((row) => filter.status === undefined || row.status === filter.status)
    .map(asSummary);
};

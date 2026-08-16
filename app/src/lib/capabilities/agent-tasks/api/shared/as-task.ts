import type { AgentTask, AgentTaskSummary } from "$agent-tasks/types/agent-task";
import type { Doc } from "$convex/_generated/dataModel";

/**
 * The stored row as the public shape, which is the one place a storage decision
 * is allowed to stop.
 *
 * `projectId` stops here. `_creationTime` becomes `createdAt`, because when a
 * task came into existence is one of the three moments a reader compares and
 * Convex's own column is not a name anything outside storage should have to know.
 */
export const asTask = (row: Doc<"agentTasks">): AgentTask => ({
  id: row._id,
  title: row.title,
  prompt: row.prompt,
  description: row.description,
  personaId: row.personaId,
  branchedFrom: row.branchedFrom,
  status: row.status,
  origin: row.origin,
  plan: row.plan,
  result: row.result,
  error: row.error,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  createdAt: row._creationTime,
  updatedAt: row.updatedAt
});

/**
 * A task as a list renders it.
 *
 * Built from `asTask` rather than from the row, so a column added to one read
 * cannot be missing from the other — the difference between them is only what a
 * directory has no use for.
 */
export const asSummary = (row: Doc<"agentTasks">): AgentTaskSummary => {
  const { prompt: _prompt, plan: _plan, result: _result, ...summary } = asTask(row);
  return summary;
};

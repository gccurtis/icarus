import { isStoredAgentTask } from "$representation/data/behavior/agents/stored-rows";
import { isStoredConnector } from "$representation/data/behavior/external/stored-connector";
import {
  hasExactFields,
  isStoredActor,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

export { isStoredConnector };

/** Exact task row sufficient to prove a current project-owned actor subject. */
export const isStoredProjectAgentTask = (value: unknown): value is TableRow<"agentTasks"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "threadId", "title", "instruction", "personaId",
        "origin", "state", "tools", "plan", "outputs", "questions", "createdBy", "startedAt",
        "revision", "updatedAt"
      ],
      ["scope", "finishedAt", "reviewedBy"]
    ) &&
    isStoredAgentTask(value) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredActor(row.createdBy) &&
    (row.reviewedBy === undefined || isStoredActor(row.reviewedBy)) &&
    (row.questions as readonly unknown[]).every((question) => {
      const fields = storedFields(question);
      return fields !== undefined &&
        (fields.answeredBy === undefined || isStoredActor(fields.answeredBy));
    });
};

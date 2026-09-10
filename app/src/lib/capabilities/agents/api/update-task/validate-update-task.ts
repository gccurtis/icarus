import {
  fieldsOf,
  has,
  idOf,
  instructionOf,
  nameOf,
  only,
  resourceSetOf,
  revisionOf,
  toolsOf
} from "$capabilities/agents/api/shared/validation";
import type { UpdateTaskInput, UpdateTaskPatch } from "$capabilities/agents/types/agents";

const SUBJECT = "update-task";

export const validateUpdateTask = (input: unknown): UpdateTaskInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["taskId", "baseRevision", "patch"], SUBJECT);
  const raw = fieldsOf(fields.patch, SUBJECT);
  only(raw, ["title", "instruction", "scope", "tools", "state"], SUBJECT);
  if (Reflect.ownKeys(raw).length === 0) throw new Error(`agents/${SUBJECT}: the patch changes nothing`);
  if (has(raw, "state") && raw.state !== "finished") {
    throw new Error(`agents/${SUBJECT}: a person can only finish a task`);
  }
  const patch: UpdateTaskPatch = {
    ...(has(raw, "title") ? { title: nameOf(raw.title, SUBJECT) } : {}),
    ...(has(raw, "instruction") ? { instruction: instructionOf(raw.instruction, SUBJECT) } : {}),
    ...(has(raw, "scope") ? { scope: raw.scope === null ? null : resourceSetOf(raw.scope, SUBJECT) } : {}),
    ...(has(raw, "tools") ? { tools: toolsOf(raw.tools, SUBJECT) } : {}),
    ...(has(raw, "state") ? { state: "finished" as const } : {})
  };
  return {
    taskId: idOf(fields.taskId, "agentTasks", SUBJECT, "taskId"),
    baseRevision: revisionOf(fields.baseRevision, SUBJECT),
    patch
  };
};

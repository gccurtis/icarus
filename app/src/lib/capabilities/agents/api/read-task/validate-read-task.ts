import { fieldsOf, idOf, only } from "$capabilities/agents/api/shared/validation";
import type { ReadTaskInput } from "$capabilities/agents/types/agents";

export const validateReadTask = (input: unknown): ReadTaskInput => {
  const fields = fieldsOf(input, "read-task");
  only(fields, ["taskId"], "read-task");
  return { taskId: idOf(fields.taskId, "agentTasks", "read-task", "taskId") };
};

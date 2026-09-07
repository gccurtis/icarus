import { fieldsOf, idOf, only, textOf } from "$capabilities/agents/api/shared/validation";
import type { SendTaskMessageInput } from "$capabilities/agents/types/agents";

export const validateSendTaskMessage = (input: unknown): SendTaskMessageInput => {
  const fields = fieldsOf(input, "send-task-message");
  only(fields, ["taskId", "text"], "send-task-message");
  return {
    taskId: idOf(fields.taskId, "send-task-message", "taskId"),
    text: textOf(fields.text, "send-task-message", "text", 20_000)
  };
};

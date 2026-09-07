import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateSendTaskMessage } from "$capabilities/agents/api/send-task-message/validate-send-task-message";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const sendTaskMessage = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateSendTaskMessage(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "agentTasks", asked.taskId);
  if (found.kind !== "found") return notFound(asked.taskId, "task");
  const task = found.row;
  if (task.state === "finished") {
    return refused(asked.taskId, "invalid-state", "the task is finished, so nothing reads its thread", task.revision);
  }
  const at = Date.now();
  appendMessage(store, scope.projectId, task.threadId, "prompt", viewer(scope), at, asked.text);
  store.update(`agentTasks.${task._id}.updatedAt`, at);
  return { accepted: true, id: task._id, revision: task.revision };
};

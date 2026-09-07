import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateReadTask } from "$capabilities/agents/api/read-task/validate-read-task";
import { findVisible } from "$capabilities/agents/api/shared/lookup";
import { taskDetail } from "$capabilities/agents/api/shared/projection";
import type { ReadTaskResult } from "$capabilities/agents/types/agents";

export const readTask = async (input: unknown): Promise<ReadTaskResult> => {
  const scope = await requireScope();
  const asked = validateReadTask(input);
  const store = serverModel().store;
  const found = findVisible(store, scope, "agentTasks", asked.taskId);
  return found.kind === "found" ? taskDetail(store, found.row, found.visible) : null;
};

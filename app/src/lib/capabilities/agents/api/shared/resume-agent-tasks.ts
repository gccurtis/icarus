import type { ServerModel } from "$runtime/server/start.server";
import { isStoredAgentTask } from "$representation/data/behavior/agents/stored-rows";

import { dispatchAgentTask } from "$capabilities/agents/api/shared/dispatch-agent-task";
import { readAgentExecutionState } from "$capabilities/agents/api/shared/runner-state";
import { rowsIn } from "$capabilities/agents/api/shared/store";

/** Resume every current running task through its explicit execution discriminator. */
export const resumeAgentTasks = (model: ServerModel): number => {
  const tasks = rowsIn(model.store, "agentTasks");
  if (tasks.some((task) => !isStoredAgentTask(task))) {
    throw new Error("The Agent task table contains a row outside the exact current stored shape");
  }
  const resumable = tasks.filter((task) => task.state === "running");
  const verified = resumable.map((task) => {
    if (task.execution.kind !== "grounded") {
      throw new Error("The running Agent task names an unsupported current executor");
    }
    const execution = readAgentExecutionState(model.store, task._id);
    if (execution === undefined || execution.task.state !== "running") {
      throw new Error("The running Agent task could not be resolved as one exact execution aggregate");
    }
    return execution.task._id;
  });
  for (const taskId of verified) {
    dispatchAgentTask(model, taskId);
  }
  return resumable.length;
};

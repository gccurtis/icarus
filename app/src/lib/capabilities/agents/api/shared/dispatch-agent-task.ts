import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { executeAgentTask } from "$capabilities/agents/api/shared/execute-agent-task";
import { agentRunnerConfiguration } from "$capabilities/agents/api/shared/runner-configuration";
import { readAgentExecutionState } from "$capabilities/agents/api/shared/runner-state";
import { settleAgentTaskFailure } from "$capabilities/agents/api/shared/settle-agent-task-failure";

export type DispatchedAgentTask = {
  readonly started: boolean;
  readonly promise: Promise<void>;
};

/** Start or join exactly one process-owned flight for a durable Agent task. */
export const dispatchAgentTask = (
  model: ServerModel,
  taskId: Id<"agentTasks">
): DispatchedAgentTask => {
  const deadlineMs = agentRunnerConfiguration(model).deadlineMs;
  const flight = model.operationFlights.runAgentTask(taskId, deadlineMs, async (signal) => {
    try {
      for (;;) {
        const outcome = await executeAgentTask(model, taskId, signal);
        if (outcome !== "retry") return;
      }
    } catch (error) {
      settleAgentTaskFailure(model, taskId, error);
    }
  });

  if (!flight.started) {
    void flight.promise.then(() => {
      const execution = readAgentExecutionState(model.store, taskId);
      if (execution?.task.state === "running") {
        dispatchAgentTask(model, taskId);
      }
    }).catch((error) => {
      model.observability.logger.error("agents.runnerFollowupFailed", {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
  void flight.promise.catch((error) => {
    model.observability.logger.error("agents.runnerPersistenceFailed", {
      taskId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
  return flight;
};

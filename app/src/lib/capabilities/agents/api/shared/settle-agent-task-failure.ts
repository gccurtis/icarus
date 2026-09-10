import type { ServerModel } from "$runtime/server/start.server";
import {
  AgentTaskCancelledError,
  AgentTaskDeadlineError,
  OperationFlightsShutdownError
} from "$model/server/operation-flights/index.server";
import type { Id } from "$representation/data/types/core/id";

import { failedRunnerPlan } from "$capabilities/agents/api/shared/runner-plan";
import { safeRunnerFailure } from "$capabilities/agents/api/shared/runner-messages";
import { readAgentExecutionState } from "$capabilities/agents/api/shared/runner-state";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import { uniqueId } from "$capabilities/agents/api/shared/store";
import type { RowFields } from "$capabilities/agents/api/shared/store";

/** Persist one terminal task failure unless shutdown deliberately left it resumable. */
export const settleAgentTaskFailure = (
  model: ServerModel,
  taskId: Id<"agentTasks">,
  error: unknown
): "restart" | "settled" | "terminal" => {
  if (error instanceof OperationFlightsShutdownError) return "restart";
  const detail = error instanceof AgentTaskCancelledError
    ? "Stopped before the Agent finished."
    : error instanceof AgentTaskDeadlineError
      ? "The Agent task ran past its deadline and was stopped."
      : `The Agent task failed: ${safeRunnerFailure(error)}`;
  const at = Date.now();
  return model.store.transaction((unit) => {
    const execution = readAgentExecutionState(unit, taskId);
    if (execution === undefined) {
      return "terminal" as const;
    }
    const { task } = execution;
    if (task.state !== "running") return "terminal" as const;
    appendMessage(
      unit,
      task.projectId,
      task.threadId,
      "agentTask",
      "response",
      { kind: "system" },
      at,
      detail
    );
    const fields: RowFields<"agentTasks"> = {
      projectId: task.projectId,
      threadId: task.threadId,
      title: task.title,
      instruction: task.instruction,
      personaId: task.personaId,
      origin: task.origin,
      ...(task.scope === undefined ? {} : { scope: task.scope }),
      tools: task.tools,
      plan: failedRunnerPlan(task.plan, detail),
      outputs: [
        ...task.outputs,
        { id: `failure-${uniqueId()}`, title: "Task did not finish", detail, at }
      ],
      questions: task.questions,
      createdBy: task.createdBy,
      startedAt: task.startedAt,
      state: "finished",
      finishedAt: at,
      revision: task.revision,
      updatedAt: at
    };
    unit.update(`agentTasks.${task._id}`, fields);
    return "settled" as const;
  });
};

import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateSendTaskMessage } from "$capabilities/agents/api/send-task-message/validate-send-task-message";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import { dispatchAgentTask } from "$capabilities/agents/api/shared/dispatch-agent-task";
import { agentRunnerConfiguration } from "$capabilities/agents/api/shared/runner-configuration";
import { queuedRunnerPlan } from "$capabilities/agents/api/shared/runner-plan";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const sendTaskMessage = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateSendTaskMessage(input);

  const model = serverModel();
  const store = model.store;
  const found = findVisible(store, scope, "agentTasks", asked.taskId);
  if (found.kind !== "found") return notFound(asked.taskId, "task");
  const task = found.row;
  if (task.state === "finished") {
    return refused(asked.taskId, "invalid-state", "the task is finished, so nothing reads its thread", task.revision);
  }
  agentRunnerConfiguration(model);
  const at = Date.now();
  store.transaction((unit) => {
    appendMessage(
      unit,
      task.projectId,
      task.threadId,
      "agentTask",
      "prompt",
      viewer(scope),
      at,
      asked.text
    );
    if (task.state === "review") {
      const fields: RowFields<"agentTasks"> = {
        projectId: task.projectId,
        threadId: task.threadId,
        title: task.title,
        instruction: task.instruction,
        personaId: task.personaId,
        origin: task.origin,
        state: "running",
        execution: { kind: "grounded" },
        ...(task.scope === undefined ? {} : { scope: task.scope }),
        tools: task.tools,
        plan: queuedRunnerPlan(),
        outputs: task.outputs,
        questions: task.questions,
        createdBy: task.createdBy,
        startedAt: task.startedAt,
        revision: task.revision,
        updatedAt: at
      };
      unit.update(`agentTasks.${task._id}`, fields);
    } else {
      unit.update(`agentTasks.${task._id}.updatedAt`, at);
    }
  });
  dispatchAgentTask(model, task._id);
  return { accepted: true, id: task._id, revision: task.revision };
};

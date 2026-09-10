import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { findVisible, notFound, refused, stale, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { scopeReferenceRefusal } from "$capabilities/agents/api/shared/scope-references";
import { appendMessage } from "$capabilities/agents/api/shared/threads";
import { dispatchAgentTask } from "$capabilities/agents/api/shared/dispatch-agent-task";
import { validateUpdateTask } from "$capabilities/agents/api/update-task/validate-update-task";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const updateTask = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateUpdateTask(input);

  const model = serverModel();
  const store = model.store;
  const found = findVisible(store, scope, "agentTasks", asked.taskId);
  if (found.kind !== "found") return notFound(asked.taskId, "task");
  const task = found.row;
  if (task.revision !== asked.baseRevision) {
    return stale(asked.taskId, asked.baseRevision, task.revision);
  }
  const patch = asked.patch;
  if (patch.instruction !== undefined && task.plan.length > 0) {
    return refused(
      asked.taskId,
      "invalid-state",
      "the agent has started on the instruction it was given; make a new task to ask differently",
      task.revision
    );
  }
  if (task.state === "finished" && (patch.state !== undefined || patch.tools !== undefined || patch.scope !== undefined)) {
    return refused(asked.taskId, "invalid-state", "a finished task does not change", task.revision);
  }

  const at = Date.now();
  const { scope: reach } = task;
  const finishing = patch.state === "finished";
  const nextScope = patch.scope === undefined ? reach : (patch.scope ?? undefined);
  const scopeRefusal = scopeReferenceRefusal(store, scope.projectId, nextScope);
  if (scopeRefusal !== undefined) {
    return refused(task._id, "invalid-state", scopeRefusal, task.revision);
  }
  const fields: RowFields<"agentTasks"> = {
    projectId: task.projectId,
    threadId: task.threadId,
    title: patch.title ?? task.title,
    instruction: patch.instruction ?? task.instruction,
    personaId: task.personaId,
    origin: task.origin,
    ...(nextScope === undefined ? {} : { scope: nextScope }),
    tools: [...(patch.tools ?? task.tools)],
    plan: task.plan,
    outputs: task.outputs,
    questions: task.questions,
    createdBy: task.createdBy,
    startedAt: task.startedAt,
    ...(finishing
      ? {
          state: "finished" as const,
          finishedAt: task.state === "running" ? at : task.finishedAt,
          ...(task.state === "review" ? { reviewedBy: viewer(scope) } : {})
        }
      : task.state === "running"
        ? { state: "running" as const, execution: task.execution }
        : task.state === "review"
          ? { state: "review" as const, finishedAt: task.finishedAt }
          : {
              state: "finished" as const,
              finishedAt: task.finishedAt,
              ...(task.reviewedBy === undefined ? {} : { reviewedBy: task.reviewedBy })
            }),
    revision: task.revision + 1,
    updatedAt: at
  };
  store.transaction((unit) => {
    if (finishing) {
      appendMessage(
        unit,
        task.projectId,
        task.threadId,
        "agentTask",
        "response",
        { kind: "system" },
        at,
        task.state === "review" ? `Marked reviewed by ${scope.username}.` : `Stopped by ${scope.username}.`
      );
    }
    unit.update(`agentTasks.${task._id}`, fields);
  });
  if (finishing && task.state === "running") {
    model.operationFlights.stopAgentTask(task._id);
  } else if (!finishing && task.state === "running") {
    dispatchAgentTask(model, task._id);
  }
  return { accepted: true, id: task._id, revision: fields.revision };
};

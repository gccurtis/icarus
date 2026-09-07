import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { findVisible, notFound, refused, stale, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { validateUpdateTask } from "$capabilities/agents/api/update-task/validate-update-task";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const updateTask = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateUpdateTask(input);

  const store = serverModel().store;
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
  const { _id, _creationTime, finishedAt, reviewedBy, scope: reach, ...rest } = task;
  void _id;
  void _creationTime;
  const finishing = patch.state === "finished";
  const nextScope = patch.scope === undefined ? reach : (patch.scope ?? undefined);
  const fields: RowFields<"agentTasks"> = {
    ...rest,
    title: patch.title ?? task.title,
    instruction: patch.instruction ?? task.instruction,
    ...(nextScope === undefined ? {} : { scope: nextScope }),
    tools: [...(patch.tools ?? task.tools)],
    state: finishing ? "finished" : task.state,
    ...(finishing ? { finishedAt: finishedAt ?? at, reviewedBy: viewer(scope) } : {
      ...(finishedAt === undefined ? {} : { finishedAt }),
      ...(reviewedBy === undefined ? {} : { reviewedBy })
    }),
    revision: task.revision + 1,
    updatedAt: at
  };
  store.update(`agentTasks.${task._id}`, fields);
  return { accepted: true, id: task._id, revision: fields.revision };
};

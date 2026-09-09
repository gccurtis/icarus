import {
  readAgentsLibrary,
  readTask,
  updateTask as updateTaskRemote,
  type UpdateTaskPatch
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Revisioned } from "$app-views/categories/agents/procedures/agents";

export const updateTask = (view: WorkspaceStateModel, task: Revisioned, patch: UpdateTaskPatch) =>
  view.singleFlight(
    flightKey(view, "update-task", task.id, task.revision, JSON.stringify(patch)),
    () =>
      updateTaskRemote({ taskId: task.id, baseRevision: task.revision, patch }).updates(
        readAgentsLibrary,
        readTask({ taskId: task.id })
      )
  );

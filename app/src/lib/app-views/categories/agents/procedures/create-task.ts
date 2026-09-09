import {
  createTask as createTaskRemote,
  readAgentsLibrary,
  type CreateTaskInput
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const createTask = (view: WorkspaceStateModel, input: CreateTaskInput) =>
  view.singleFlight(flightKey(view, "create-task", input.personaId, input.title), () =>
    createTaskRemote(input).updates(readAgentsLibrary)
  );

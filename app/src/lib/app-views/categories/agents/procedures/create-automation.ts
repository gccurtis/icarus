import {
  createAutomation as createAutomationRemote,
  readAgentsLibrary,
  type CreateAutomationInput
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const createAutomation = (view: WorkspaceStateModel, input: CreateAutomationInput) =>
  view.singleFlight(flightKey(view, "create-automation", input.personaId, input.name), () =>
    createAutomationRemote(input).updates(readAgentsLibrary)
  );

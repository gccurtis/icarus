import { createPersona as createPersonaRemote, readAgentsLibrary } from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const createPersona = (view: WorkspaceStateModel, name: string) =>
  view.singleFlight(flightKey(view, "create-persona", name), () =>
    createPersonaRemote({ name }).updates(readAgentsLibrary)
  );

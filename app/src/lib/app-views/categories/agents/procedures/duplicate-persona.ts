import {
  duplicatePersona as duplicatePersonaRemote,
  readAgentsLibrary
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const duplicatePersona = (view: WorkspaceStateModel, personaId: string) =>
  view.singleFlight(flightKey(view, "duplicate-persona", personaId), () =>
    duplicatePersonaRemote({ personaId }).updates(readAgentsLibrary)
  );

import {
  readAgentsLibrary,
  readPersona,
  removePersona as removePersonaRemote
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Revisioned } from "$app-views/categories/agents/procedures/agents";

export const removePersona = (view: WorkspaceStateModel, persona: Revisioned) =>
  view.singleFlight(flightKey(view, "remove-persona", persona.id, persona.revision), () =>
    removePersonaRemote({ personaId: persona.id, baseRevision: persona.revision }).updates(
      readAgentsLibrary,
      readPersona({ personaId: persona.id })
    )
  );

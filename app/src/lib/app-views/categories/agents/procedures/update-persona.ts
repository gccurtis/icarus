import {
  readAgentsLibrary,
  readPersona,
  updatePersona as updatePersonaRemote,
  type UpdatePersonaPatch
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Revisioned } from "$app-views/categories/agents/procedures/agents";

export const updatePersona = (
  view: WorkspaceStateModel,
  persona: Revisioned,
  patch: UpdatePersonaPatch
) =>
  view.singleFlight(
    flightKey(view, "update-persona", persona.id, persona.revision, JSON.stringify(patch)),
    () =>
      updatePersonaRemote({ personaId: persona.id, baseRevision: persona.revision, patch }).updates(
        readAgentsLibrary,
        readPersona({ personaId: persona.id })
      )
  );

import {
  readAgentsLibrary,
  readAutomation,
  updateAutomation as updateAutomationRemote,
  type UpdateAutomationPatch
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Revisioned } from "$app-views/categories/agents/procedures/agents";

export const updateAutomation = (
  view: WorkspaceStateModel,
  automation: Revisioned,
  patch: UpdateAutomationPatch
) =>
  view.singleFlight(
    flightKey(view, "update-automation", automation.id, automation.revision, JSON.stringify(patch)),
    () =>
      updateAutomationRemote({
        automationId: automation.id,
        baseRevision: automation.revision,
        patch
      }).updates(readAgentsLibrary, readAutomation({ automationId: automation.id }))
  );

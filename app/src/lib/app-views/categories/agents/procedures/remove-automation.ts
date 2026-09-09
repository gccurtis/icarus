import {
  readAgentsLibrary,
  readAutomation,
  removeAutomation as removeAutomationRemote
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Revisioned } from "$app-views/categories/agents/procedures/agents";

export const removeAutomation = (view: WorkspaceStateModel, automation: Revisioned) =>
  view.singleFlight(flightKey(view, "remove-automation", automation.id, automation.revision), () =>
    removeAutomationRemote({
      automationId: automation.id,
      baseRevision: automation.revision
    }).updates(readAgentsLibrary, readAutomation({ automationId: automation.id }))
  );

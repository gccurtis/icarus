import {
  readAgentsLibrary,
  readAutomation,
  runAutomation as runAutomationRemote
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

/**
 * Fires a rule by hand. The clock is part of the key on purpose: two presses are
 * two runs, where two presses of Save on the same revision are one write.
 */
export const runAutomation = (view: WorkspaceStateModel, automationId: string) =>
  view.singleFlight(flightKey(view, "run-automation", automationId, Date.now()), () =>
    runAutomationRemote({ automationId }).updates(
      readAgentsLibrary,
      readAutomation({ automationId })
    )
  );

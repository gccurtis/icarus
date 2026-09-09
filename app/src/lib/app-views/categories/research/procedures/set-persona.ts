import { readThreads, setThreadPersona } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Working } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";

/**
 * Who this chat answers as, from now on.
 *
 * Past turns keep the prompt they were answered under, so this never rewrites
 * what was said. An empty choice is the project's default voice.
 */
export const setPersona = async (
  view: WorkspaceStateModel,
  state: Working,
  threadId: string,
  personaId: string
): Promise<void> => {
  try {
    await view.singleFlight(flightKey(view, "persona", threadId), () =>
      setThreadPersona({ threadId, personaId: personaId === "" ? null : personaId }).updates(
        readThreads
      )
    );
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  }
};

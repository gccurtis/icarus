import { readThreads, removeThread as removeThreadRemote } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, type Working } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";

/** Takes a chat and everything it holds. Refused while a turn is still running. */
export const removeThread = async (
  view: WorkspaceStateModel,
  state: Working,
  threadId: string
): Promise<void> => {
  try {
    const result = await view.singleFlight(flightKey(view, "remove", threadId), () =>
      removeThreadRemote({ threadId }).updates(readThreads)
    );
    if (state.mounted && !result.accepted) state.failure = result.detail;
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  }
};

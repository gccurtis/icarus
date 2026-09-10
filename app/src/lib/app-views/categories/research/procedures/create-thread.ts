import { createThread as createThreadRemote, readThreads } from "$capabilities/research-chat/index.remote";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, openThread, type Working } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";

/**
 * Opens an empty chat and puts the surface on it.
 *
 * The tab bar names a chat from the scoped represented-resource index, so that
 * projection is refreshed before the tab opens on the new row.
 */
export const createThread = async (
  view: WorkspaceStateModel,
  state: Working
): Promise<void> => {
  if (state.pending) return;
  state.pending = true;
  state.failure = undefined;
  try {
    const made = await view.singleFlight(flightKey(view, "create"), () =>
      createThreadRemote({}).updates(readThreads, readProjectResourceIndex)
    );
    if (state.mounted) openThread(view, made.threadId);
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  } finally {
    if (state.mounted) state.pending = false;
  }
};

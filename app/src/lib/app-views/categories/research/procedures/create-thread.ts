import { createThread as createThreadRemote, readThreads } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey, openThread, type Working } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";

/**
 * Opens an empty chat and puts the surface on it.
 *
 * The tab bar names a chat from the workspace's own thread read, which may be
 * warm but unmounted, so it is refreshed before the tab opens on the new row.
 */
export const createThread = async (
  view: WorkspaceStateModel,
  state: Working
): Promise<void> => {
  if (state.pending) return;
  state.pending = true;
  state.failure = undefined;
  try {
    const made = await view.singleFlight(flightKey(view, "create"), async () => {
      const opened = await createThreadRemote({}).updates(readThreads);
      await view.readStore("researchThreads").refresh();
      return opened;
    });
    if (state.mounted) openThread(view, made.threadId);
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  } finally {
    if (state.mounted) state.pending = false;
  }
};

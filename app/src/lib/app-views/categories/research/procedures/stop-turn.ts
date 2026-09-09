import { readThreads, stopTurn as stopTurnRemote } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
import { messageOf } from "$app-views/categories/research/procedures/failure";

/**
 * First press asks the run to answer from what it has; a second abandons it.
 *
 * The surface only records that it asked. Which of the two this press is, is
 * decided by the server from the turn it finds running, and a refusal is only
 * worth showing on the second press — the first one raced a turn that had
 * already finished, which is not something to interrupt somebody about.
 */
export const stopTurn = async (
  view: WorkspaceStateModel,
  state: ThreadState,
  threadId: string
): Promise<void> => {
  const already = state.stopping;
  state.stopping = true;
  try {
    const result = await stopTurnRemote({ threadId }).updates(readThreads);
    if (state.mounted && !result.accepted && already) state.failure = result.detail;
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  }
};

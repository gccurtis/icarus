import { ask, readThreads } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
import { flightKey } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";
import { inspectTurn } from "$app-views/categories/research/procedures/inspect-turn";

/**
 * One question, from the field to the turn that answers it.
 *
 * The field is cleared optimistically and the text is put back if the capability
 * refuses, so a rejected question is never lost. The first question also names
 * the chat, and the tab bar reads that name from the workspace's own copy of the
 * thread list, so that read is refreshed here rather than left stale.
 */
export const askQuestion = async (
  view: WorkspaceStateModel,
  state: ThreadState,
  threadId: string,
  written: string
): Promise<void> => {
  if (state.pending) return;
  state.asking = written;
  state.text = "";
  state.pending = true;
  state.failure = undefined;
  try {
    const result = await view.singleFlight(flightKey(view, "ask", threadId), async () => {
      const answered = await ask({ threadId, text: written, scope: state.chosenScope() }).updates(
        readThreads
      );
      await view.readStore("researchThreads").refresh();
      return answered;
    });
    if (!state.mounted) return;
    if (result.accepted) {
      state.claimed = result.turnId;
      inspectTurn(view, result.turnId);
    } else {
      state.failure = result.detail;
      state.text = written;
    }
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  } finally {
    if (state.mounted) {
      state.pending = false;
      state.stopping = false;
      state.asking = undefined;
    }
  }
};

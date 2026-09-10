import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
import { flightKey } from "$app-views/categories/research/procedures/chat";
import { messageOf } from "$app-views/categories/research/procedures/failure";
import { refreshThread } from "$app-views/categories/research/procedures/refresh-thread";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

type Refreshable = {
  refresh(): Promise<unknown>;
};

/**
 * Reconcile a newly mounted centre with the durable turn once per open chat.
 *
 * A question can outlive the centre that sent it. The remote command persists
 * its running turn before provider work begins, but the detail query may still
 * hold the pre-command result when the tab is shown again. The normal case is
 * one lifecycle read; an immediate remount retries only while that exact
 * workspace command is pending, without inventing client-only progress.
 */
export const refreshThreadWhenShown = (
  view: WorkspaceStateModel,
  state: ThreadState,
  threadId: () => string | undefined,
  detail: () => Refreshable | undefined,
  hasRunningTurn: () => boolean
): void => {
  $effect(() => {
    const id = threadId();
    const query = detail();
    if (id === undefined || query === undefined || state.refreshedThread === id) return;
    let current = true;
    const key = flightKey(view, "ask", id);
    void refreshThread({
      detail: query,
      current: () =>
        current && state.mounted && threadId() === id && detail() === query,
      hasRunningTurn,
      pendingFlight: () => view.pendingFlight(key)
    }).then((outcome) => {
      if (!current || !state.mounted || threadId() !== id || detail() !== query) return;
      if (outcome.state === "refreshed") {
        state.refreshedThread = id;
        if (state.refreshFailure?.threadId === id) state.refreshFailure = undefined;
      } else if (outcome.state === "failed") {
        state.refreshFailure = { threadId: id, message: messageOf(outcome.error) };
      }
    });
    return () => {
      current = false;
    };
  });
};

import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
import { inspectTurn } from "$app-views/categories/research/procedures/inspect-turn";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * The inspector opens on the newest turn, once per turn.
 *
 * `claimed` is what has already been handed over, so somebody who then chose an
 * older turn is not dragged back to the newest one on the next redraw.
 */
export const followNewestTurn = (
  view: WorkspaceStateModel,
  state: ThreadState,
  newestId: () => string | undefined
): void => {
  $effect(() => {
    const id = newestId();
    if (id === undefined || state.claimed === id) return;
    state.claimed = id;
    inspectTurn(view, id);
  });
};

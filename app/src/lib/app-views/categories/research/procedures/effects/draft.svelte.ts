import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
import { draftFor, keepDraft } from "$app-views/categories/research/procedures/drafts";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * The half-written question follows the chat, not the surface.
 *
 * `held` is which chat the field currently belongs to. Until it agrees with the
 * open chat the field has not been restored yet, and saving what is in it would
 * overwrite the draft with the empty string it starts at.
 */
export const keepDraftWithChat = (
  view: WorkspaceStateModel,
  state: ThreadState,
  threadId: () => string | undefined
): void => {
  $effect(() => {
    const id = threadId();
    if (state.held === id) return;
    if (state.held !== undefined) keepDraft(view, state.held, state.text);
    state.held = id;
    state.text = draftFor(view, id);
  });
  $effect(() => {
    const id = threadId();
    if (state.held !== id) return;
    keepDraft(view, id, state.text);
  });
};

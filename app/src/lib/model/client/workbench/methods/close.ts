import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { persist } from "$model/client/workbench/methods/shared/persist";
import type { TabId } from "$model/client/workbench/types";

/**
 * Closes a tab, and chooses the next active one when it was the active one.
 *
 * Refuses a permanent tab rather than ignoring the call: the UI must not offer
 * to close one, so a request to is a defect in the caller.
 */
export const close = (state: WorkbenchState, id: TabId): void => {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) throw new Error(`Cannot close unknown tab ${id}.`);
  if (state.tabs[index].permanent) {
    throw new Error(`Tab ${id} is permanent and cannot be closed.`);
  }

  const wasActive = state.activeId === id;
  state.tabs.splice(index, 1);

  if (wasActive) {
    // Right, then left. After the splice the element now *at* `index` is the one
    // that was to the right. A permanent tab always survives, so this cannot
    // fall through to nothing.
    const next = state.tabs[index] ?? state.tabs[index - 1];
    state.activeId = next.id;
  }

  persist(state);
};

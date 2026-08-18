import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { TabId } from "$model/client/workbench/types";
import { isPermanent } from "$model/client/workbench/types";

/** How many closed tabs the reopen queue holds before the oldest falls off. */
const REOPEN_LIMIT = 10;

/**
 * Closes a tab, and remembers the whole of it.
 *
 * Refuses a singleton rather than ignoring the call: the UI must not offer to
 * close one, so a request to is a defect in the surface that offered it.
 *
 * **The whole tab goes onto the queue**, not just its target, so a reopen
 * restores zoom, find query, rail position and panel widths losslessly. The
 * queue is capped at ten and the oldest simply falls off.
 *
 * **Release happens here, not when the tab falls off the queue.** Release is the
 * flush — a closed tab holding an unflushed buffer would mean the user's last
 * edits sit unsent until ten unrelated tabs close. Only the runtime is rebuilt
 * on reopen, from a backend that by then has the edits.
 *
 * Closing the active tab activates its left neighbour. A singleton always
 * survives, so there is always one, and index 0 is only reachable when the
 * closed tab was not at index 0.
 */
export const close = (state: WorkbenchState, id: TabId): void => {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    throw new Error(`Tab ${id} does not exist.`);
  }

  const tab = state.tabs[index];
  if (isPermanent(tab)) {
    throw new Error(`Tab ${id} is permanent and cannot be closed.`);
  }

  state.tabs = state.tabs.filter((candidate) => candidate.id !== id);
  state.closed = [tab, ...state.closed].slice(0, REOPEN_LIMIT);

  if (tab.target.kind === "resource") {
    state.runtimes.release(tab.target.resourceType, tab.target.resourceId);
  }

  if (state.activeId === id) {
    state.activeId = state.tabs[Math.max(0, index - 1)].id;
  }
};

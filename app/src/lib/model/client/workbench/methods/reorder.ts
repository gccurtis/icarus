import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { TabId } from "$model/client/workbench/types";
import { isPermanent } from "$model/client/workbench/types";

/**
 * Moves a closable tab to a new position.
 *
 * **`index` counts closable tabs only**, because singletons have no index — they
 * hold the leading positions and cannot be dragged, so the positions a user can
 * see are the ones after them.
 *
 * Refuses a singleton, for the same reason `close` does: the strip must not
 * offer to drag one.
 *
 * Clamping rather than throwing on an out-of-range index. A drag that overshoots
 * the end of the strip means the end, and a gesture is not a defect.
 */
export const reorder = (state: WorkbenchState, id: TabId, index: number): void => {
  const from = state.tabs.findIndex((tab) => tab.id === id);
  if (from === -1) {
    throw new Error(`Tab ${id} does not exist.`);
  }
  if (isPermanent(state.tabs[from])) {
    throw new Error(`Tab ${id} is permanent and cannot be reordered.`);
  }

  const offset = state.tabs.filter(isPermanent).length;
  const closable = state.tabs.length - offset;
  const to = offset + Math.min(Math.max(index, 0), closable - 1);

  const next = [...state.tabs];
  const [tab] = next.splice(from, 1);
  next.splice(to, 0, tab);

  state.tabs = next;
};

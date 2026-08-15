import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { persist } from "$model/client/workbench/methods/shared/persist";
import type { TabId } from "$model/client/workbench/types";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Moves a transient tab to a position among the transient tabs.
 *
 * `index` counts transient tabs only, because permanent ones have no index — they
 * hold the leading positions and cannot be dragged, which is what keeps the
 * draggable tabs a contiguous run at the end.
 */
export const reorder = (state: WorkbenchState, id: TabId, index: number): void => {
  const from = state.tabs.findIndex((tab) => tab.id === id);
  if (from === -1) throw new Error(`Cannot reorder unknown tab ${id}.`);
  if (state.tabs[from].permanent) {
    throw new Error(`Tab ${id} is permanent and cannot be reordered.`);
  }

  // Offset past the permanent prefix. Clamping rather than throwing: a drag that
  // overshoots either end is an ordinary gesture, not a caller error.
  const offset = state.tabs.filter((tab) => tab.permanent).length;
  const to = offset + clamp(index, 0, state.tabs.length - offset - 1);

  const [tab] = state.tabs.splice(from, 1);
  state.tabs.splice(to, 0, tab);
  persist(state);
};

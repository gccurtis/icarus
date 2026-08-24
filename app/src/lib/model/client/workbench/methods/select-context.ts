import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { assignState } from "$model/client/workbench/methods/shared/assign-state";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";

/**
 * Records the active tab's rail position, so each tab keeps its own.
 *
 * **The label is never interpreted.** Which contexts a screen offers, what each
 * one is called, and what happens to a stored id that is no longer on the rail
 * all belong to `views/context-panel/` — this object remembers a string.
 *
 * That is the same relationship the inspector keeps, and the symmetry is what
 * stops this object growing a fifty-member union as screens arrive. The cost is
 * that it cannot refuse an id the rail never offered; the panel resolves an
 * unknown one to its own default, which is where the knowledge to do that lives.
 *
 * Separate from `resize` deliberately. A drag can never move the rail and a rail
 * click can never resize a panel, structurally rather than by convention.
 */
export const selectContext = (state: WorkbenchState, id: string): void => {
  assignState(state, activeTab(state).id, (tab) => {
    tab.viewState.frame.contextId = id;
  });
};

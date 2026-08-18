import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Frame } from "$model/client/workbench/types";
import { assignState } from "$model/client/workbench/methods/shared/assign-state";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";

/**
 * Records panel geometry on the active tab.
 *
 * **Values only, and it cannot reach `contextId`.** The patch type excludes it,
 * so a drag can never move the rail and a rail click can never resize a panel —
 * structurally rather than by convention.
 *
 * Bounds are the panel's. The minimum, the maximum, and the width below which a
 * drag collapses rather than clamps all belong to the component that enforces
 * the gesture, because it is the thing that knows a drag overshot. Storing a
 * bound here as well would put the same number in two places.
 */
export const resize = (state: WorkbenchState, patch: Partial<Omit<Frame, "contextId">>): void => {
  assignState(state, activeTab(state).id, (tab) => {
    Object.assign(tab.viewState.frame, patch);
  });
};

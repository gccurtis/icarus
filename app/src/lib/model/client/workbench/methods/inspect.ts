import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { InspectionKey } from "$model/client/workbench/types";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";

/**
 * Replaces what the active tab has under inspection. Passing nothing clears it.
 *
 * **Set only by an explicit call, never derived from focus.** That is what lets
 * it hold: clicking into the inspector blurs the editor and collapses the caret,
 * and an inspection derived from focus would empty the panel the user is
 * reaching for.
 *
 * The documented exception to the one-write-path rule. An inspection is not
 * per-screen typed and is never persisted, so routing it through `assignState`
 * would mean widening that procedure to carry something it has no business
 * knowing about.
 */
export const inspect = (state: WorkbenchState, key?: InspectionKey): void => {
  activeTab(state).inspected = key;
};

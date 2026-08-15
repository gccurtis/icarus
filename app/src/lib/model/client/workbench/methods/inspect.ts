import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import { assignOptions } from "$model/client/workbench/methods/shared/assign-options";
import type { Inspection } from "$model/client/workbench/types";

/**
 * Replaces the active tab's inspection. Passing nothing clears it.
 *
 * Nothing in this object listens to focus or selection events, so an inspection
 * changes only here. That is what lets it hold while the editor is blurred:
 * clicking into the inspector collapses the caret, and the panel keeps showing
 * what the user came to work on. An inspection derived from focus would empty
 * the panel the user is reaching for.
 */
export const inspect = (state: WorkbenchState, inspection?: Inspection): void => {
  assignOptions(state, activeTab(state), { inspection });
};

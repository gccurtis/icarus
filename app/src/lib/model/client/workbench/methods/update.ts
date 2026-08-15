import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { assignOptions } from "$model/client/workbench/methods/shared/assign-options";
import type { TabId, TabOptions } from "$model/client/workbench/types";

/**
 * Patches any tab's options by id.
 *
 * The general form. `selectActivity`, `inspect`, and `resize` are the named ways
 * to change one option on the active tab; this is how a caller changes an option
 * on a tab that is not active, which is what a background load or a restore
 * needs.
 */
export const update = (
  state: WorkbenchState,
  id: TabId,
  patch: Partial<TabOptions>
): void => {
  const tab = state.tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Cannot update unknown tab ${id}.`);
  assignOptions(state, tab, patch);
};

import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import { assignOptions } from "$model/client/workbench/methods/shared/assign-options";
import type { ContextId } from "$model/client/workbench/types";
import { CONTEXTS_BY_KIND } from "$model/client/workbench/types";

/**
 * Records a rail choice on the active tab.
 *
 * On the tab rather than on the workbench, so each tab keeps its own rail
 * position and switching tabs restores it. A context the tab's kind does not
 * offer is refused: the rail can only have rendered what is available, so a
 * caller passing anything else has a defect rather than a stale value.
 */
export const selectContext = (state: WorkbenchState, id: ContextId): void => {
  const tab = activeTab(state);
  if (!CONTEXTS_BY_KIND[tab.resource.kind].includes(id)) {
    throw new Error(`Context ${id} is not available for resource kind ${tab.resource.kind}.`);
  }
  assignOptions(state, tab, { contextId: id });
};

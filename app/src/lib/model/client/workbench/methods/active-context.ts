import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { ContextId } from "$model/client/workbench/types";
import { CONTEXTS_BY_KIND } from "$model/client/workbench/types";

/**
 * The active tab's rail position, or its kind's default.
 *
 * Falling back rather than throwing: a tab's remembered context can outlive a
 * change to what its kind offers, and a reset rail is a harmless outcome where a
 * crash is not. `selectContext` does throw, because that is a caller naming a
 * context the kind never offered, which is a defect rather than drift.
 */
export const activeContext = (state: WorkbenchState): ContextId => {
  const tab = activeTab(state);
  const available = CONTEXTS_BY_KIND[tab.resource.kind];
  const chosen = tab.options.contextId;
  return chosen !== undefined && available.includes(chosen) ? chosen : available[0];
};

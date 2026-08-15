import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { ActivityId } from "$model/client/workbench/types";
import { ACTIVITIES_BY_KIND } from "$model/client/workbench/types";

/**
 * The active tab's rail position, or its kind's default.
 *
 * Falling back rather than throwing: a tab's remembered activity can outlive a
 * change to what its kind offers, and a reset rail is a harmless outcome where a
 * crash is not. `selectActivity` does throw, because that is a caller naming an
 * activity the kind never offered, which is a defect rather than drift.
 */
export const activeActivity = (state: WorkbenchState): ActivityId => {
  const tab = activeTab(state);
  const available = ACTIVITIES_BY_KIND[tab.resource.kind];
  const chosen = tab.options.activityId;
  return chosen !== undefined && available.includes(chosen) ? chosen : available[0];
};

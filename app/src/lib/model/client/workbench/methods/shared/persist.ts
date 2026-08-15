import type { PersistedTab, PersistedTabOptions } from "$model/client/storage";
import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { Tab } from "$model/client/workbench/types";

/**
 * Writes the whole workbench to storage.
 *
 * Whole rather than incremental, so a store damaged by hand or by an older build
 * is repaired by the next mutation. Storage coalesces the writes, so a method
 * touching two things still costs one serialization.
 */
export const persist = (state: WorkbenchState): void => {
  const active = activeTab(state);
  state.storage.saveWorkbench({
    tabs: state.tabs.map(toPersisted),
    active: [active.resource.kind, active.resource.id]
  });
};

/**
 * Only what outlives the tab's session goes out.
 *
 * The permanent tab is written too, and it is the one entry that is not there to
 * be reopened — it is reconstructed at construction. Its entry carries the
 * geometry the user dragged on it, which would otherwise be the one panel size
 * in the application that a reload forgot. Replaying it costs nothing because
 * `open()` dedupes on kind and id.
 */
const toPersisted = (tab: Tab): PersistedTab => {
  const { activityId, panels } = tab.options;
  if (activityId === undefined && panels === undefined) {
    return [tab.resource.kind, tab.resource.id];
  }

  const options: PersistedTabOptions = {
    ...(activityId === undefined ? {} : { activityId }),
    ...(panels === undefined ? {} : { panels })
  };
  return [tab.resource.kind, tab.resource.id, options];
};

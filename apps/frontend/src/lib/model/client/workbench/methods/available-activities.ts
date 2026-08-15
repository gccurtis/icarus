import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { ActivityId } from "$model/client/workbench/types";
import { ACTIVITIES_BY_KIND } from "$model/client/workbench/types";

/**
 * What the context panel's rail offers for whatever the active tab holds.
 *
 * Static per resource kind, and total over the kinds, so this cannot fail for a
 * tab the workbench admitted — a stored kind that no longer exists is dropped
 * before the tab is created.
 */
export const availableActivities = (state: WorkbenchState): readonly ActivityId[] =>
  ACTIVITIES_BY_KIND[activeTab(state).resource.kind];

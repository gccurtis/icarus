import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { InspectionKey } from "$model/client/workbench/types";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";

/**
 * What the active tab has under inspection, or `undefined` for nothing.
 *
 * Undefined is the inspector's cue to render the nothing-inspected view. That
 * state has no key to hand a view, so reporting an empty string instead would
 * make every view defend against a label that means nothing.
 *
 * The key travels alone. The inspector routes on the prefix before the dot and
 * reads the detail from view state — or, for the copilot family, from the
 * copilot object, since those belong to no tab.
 */
export const inspectedNode = (state: WorkbenchState): InspectionKey | undefined =>
  activeTab(state).inspected;

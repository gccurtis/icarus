import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import type { Panels } from "$model/client/workbench/types";
import { DEFAULTS } from "$model/client/workbench/types";

/**
 * The active tab's panel geometry.
 *
 * `DEFAULTS` while the tab has none of its own, rather than every tab being born
 * with a copy: a tab nobody dragged stores nothing, and it follows a later change
 * to the defaults instead of pinning the values that were current when it opened.
 */
export const panels = (state: WorkbenchState): Panels =>
  activeTab(state).options.panels ?? DEFAULTS;

import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import { assignOptions } from "$model/client/workbench/methods/shared/assign-options";
import type { Panels } from "$model/client/workbench/types";
import { DEFAULTS } from "$model/client/workbench/types";

/**
 * Records panel geometry on the active tab.
 *
 * Per tab rather than per workbench, which is the whole of what the deleted
 * preferences object held. A user sizing the inspector while reading one
 * document has said something about that document, not about the application.
 *
 * Values only. The minimum, the maximum, and the width below which a drag
 * collapses belong to the panel component that enforces the drag, because that
 * is the thing which knows a gesture overshot.
 *
 * The spread over `DEFAULTS` is load-bearing: without it the first resize would
 * write the frozen constant itself onto the tab, and `DEFAULTS` is frozen so
 * that mistake throws rather than leaking into every later reader.
 */
export const resize = (state: WorkbenchState, patch: Partial<Panels>): void => {
  const tab = activeTab(state);
  assignOptions(state, tab, { panels: { ...DEFAULTS, ...tab.options.panels, ...patch } });
};

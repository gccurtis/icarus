import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import type { ContextId } from "$model/client/view-state/methods/shared/panel-keys";
import { offersContext } from "$model/client/view-state/methods/shared/rails";

/**
 * Move the rail.
 *
 * **It throws for a view this subscreen does not offer, and `context` falls back
 * silently for one it no longer offers.** The asymmetry is deliberate and the two
 * cases are different: a remembered context can drift out of range when a
 * subscreen changes, and a reset rail is harmless where a crash is not — but a
 * caller naming a view no screen offers has made a mistake, and swallowing it
 * would leave the panel blank with nothing to explain why.
 */
export const selectContext = (state: ViewStateData, id: ContextId): void => {
  const tab = state.active;
  if (!offersContext(tab.screen, tab.subscreen, id)) {
    throw new Error(`'${tab.screen}/${tab.subscreen}' does not offer '${id}'`);
  }
  tab.contextId = id;
};

import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { isPermanent } from "$model/client/workbench/types";

/**
 * Clears to the singletons. What a client instance runs on its way out.
 *
 * `releaseAll` rather than a release per tab: the register already knows every
 * open resource, and a closing tab's budget does not stretch to walking the
 * strip.
 *
 * **The reopen queue is not filled.** These tabs are not being closed by a
 * person, and offering to reopen them after teardown would be offering to
 * reopen a session that has ended.
 *
 * **Deliberately does not persist**, when persistence returns. Writing an
 * emptied strip on teardown would erase exactly what a reload is meant to
 * restore.
 */
export const closeAll = (state: WorkbenchState): void => {
  state.runtimes.releaseAll();

  state.tabs = state.tabs.filter(isPermanent);
  state.activeId = state.tabs[0].id;
};

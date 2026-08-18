import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab } from "$model/client/workbench/types";

/**
 * The active tab, which always exists.
 *
 * `activeId` names a real tab by construction: the singletons are built with the
 * workbench and none can be closed, so there is always something for `close` and
 * `closeAll` to fall back to. The final `?? tabs[0]` is not a defence against
 * that failing — it is what makes the return type non-optional, so that eight
 * callers do not each write a guard for a case the object rules out.
 *
 * Shared by everything that reads or writes the active tab.
 */
export const activeTab = (state: WorkbenchState): Tab =>
  state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0];

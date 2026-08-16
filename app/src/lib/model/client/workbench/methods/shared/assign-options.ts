import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { persist } from "$model/client/workbench/methods/shared/persist";
import type { Tab, TabOptions } from "$model/client/workbench/types";

/**
 * The one path by which a tab's options change.
 *
 * Options are replaced rather than mutated in place, so a consumer holding an
 * old options object cannot observe a later write through it.
 *
 * It also owns the line between what survives a reload and what does not.
 * `inspection` names block ids and character offsets in a document that may have
 * changed since, and `scrollTop` is the same case; persisting on every caret
 * move would be a write per keystroke-adjacent action. So a patch persists only
 * when it names a field that outlives the session — and it persists when that
 * field is being cleared, because absence has to survive a reload too.
 */
export const assignOptions = (
  state: WorkbenchState,
  tab: Tab,
  patch: Partial<TabOptions>
): void => {
  tab.options = { ...tab.options, ...patch };
  if ("contextId" in patch || "panels" in patch) persist(state);
};

import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab, TabTarget } from "$model/client/workbench/types";
import { adoptTarget } from "$model/client/workbench/methods/shared/adopt-target";
import { targetKey } from "$model/client/workbench/methods/shared/target-key";

/**
 * Open a target, or activate the tab already on it.
 *
 * Idempotent for anything with an identity, which is what makes clicking the
 * same document twice one tab rather than two. A launcher has no identity, so
 * `targetKey` returns nothing and this mints every time.
 *
 * **Attaching happens here, not in the view.** The workbench is the thing that
 * knows when a tab begins, so opening a resource tab is what brings its runtime
 * into being — and `attach` is idempotent, so a second tab on one document
 * shares the first one's buffer rather than starting a second.
 *
 * A new tab lands at the end of the strip. Singletons hold the leading
 * positions, so the closable ones a user can drag are always a contiguous run at
 * the end — which is what lets `reorder` count them alone.
 */
export const open = (state: WorkbenchState, target: TabTarget): Tab => {
  const key = targetKey(target);
  const existing =
    key === undefined ? undefined : state.tabs.find((tab) => targetKey(tab.target) === key);

  if (existing) {
    state.activeId = existing.id;
    return existing;
  }

  const tab = adoptTarget(state, target);
  state.tabs = [...state.tabs, tab];
  state.activeId = tab.id;

  if (target.kind === "resource") {
    state.runtimes.attach(target.resourceType, target.resourceId);
  }

  return tab;
};

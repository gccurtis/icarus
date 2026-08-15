import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { persist } from "$model/client/workbench/methods/shared/persist";
import type { ResourceRef, Tab } from "$model/client/workbench/types";

/**
 * Opens a resource, or activates the tab already holding it.
 *
 * The single way a tab enters this workbench. Restoring goes through it too, so
 * a stored tab cannot arrive by a path that skips the dedupe.
 */
export const open = (state: WorkbenchState, resource: ResourceRef): Tab => {
  // Match on kind *and* id: ids are only unique within a kind.
  const existing = state.tabs.find(
    (tab) => tab.resource.kind === resource.kind && tab.resource.id === resource.id
  );
  if (existing) {
    state.activeId = existing.id;
    persist(state);
    return existing;
  }

  const tab: Tab = { id: state.nextId(), resource, permanent: false, options: {} };
  state.tabs.push(tab);
  state.activeId = tab.id;
  persist(state);
  return tab;
};

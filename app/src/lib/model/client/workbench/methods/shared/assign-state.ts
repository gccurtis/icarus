import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab } from "$model/client/workbench/types";

/**
 * **The one write path into a tab's view state.**
 *
 * `update`, `resize` and `selectContext` all route through here, which is what
 * makes "view state changes in exactly one place" a fact about the code rather
 * than a convention three methods happen to follow. When persistence returns,
 * this is the single point that decides whether a change is worth a write —
 * which is the reason it exists as a procedure rather than as three inline
 * mutations.
 *
 * `inspect()` is the documented exception: an inspection is not per-screen typed
 * and is never persisted, so routing it through a typed view-state write would
 * mean widening this to carry something it has no business knowing about.
 *
 * Throws for an id that names nothing. Every caller here holds a `TabId` it got
 * from this object, so an unknown one is a defect rather than a race — and a
 * silent no-op would lose a user's edit with nothing to find later.
 */
export const assignState = (
  state: WorkbenchState,
  id: string,
  mutate: (tab: Tab) => void
): void => {
  const tab = state.tabs.find((candidate) => candidate.id === id);
  if (!tab) {
    throw new Error(`Tab ${id} does not exist.`);
  }

  mutate(tab);
};

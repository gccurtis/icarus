import type { ViewStateData } from "$model/client/view-state/definition.svelte";

/**
 * Nothing selected.
 *
 * A state rather than an absence, which is why the inspector has a lens for it
 * and why this sets a key rather than deleting one. It clears the selection too:
 * a lens showing nothing beside a selection that still names something is two
 * answers to what the person is looking at.
 */
export const clear = (state: ViewStateData): void => {
  const tab = state.active;
  tab.inspected = "empty";
  tab.selection = undefined;
};

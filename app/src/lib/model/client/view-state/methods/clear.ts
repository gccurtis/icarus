import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { perform } from "$model/client/view-state/methods/shared/perform";

export const clear = (state: ViewStateData): void => {
  const id = state.tabs.activeId;
  const view = state.views.of(id);

  perform(state, {
    op: "inspect",
    tab: id,
    was: view.inspected,
    now: "empty",
    wasSelection: view.selection,
    selection: null
  });
};

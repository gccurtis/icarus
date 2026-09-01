import type { ContextId } from "$representation/data/types/views/panels";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { perform } from "$model/client/view-state/methods/shared/perform";
import { offersContext } from "$model/client/view-state/methods/shared/rails";

export const selectContext = (state: ViewStateData, id: ContextId): void => {
  const record = state.tabs.active;
  const view = state.views.of(record.id);

  if (!offersContext(record.screen, view.subscreen, id)) {
    throw new Error(`'${record.screen}/${view.subscreen}' does not offer '${id}'`);
  }

  perform(state, { op: "context", tab: record.id, was: view.contextId, now: id });
};

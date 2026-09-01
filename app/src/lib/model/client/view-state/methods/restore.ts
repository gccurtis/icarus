import { readViewState } from "$capabilities/view/index.remote";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";

export const restore = async (state: ViewStateData): Promise<void> => {
  if (!state.persists || state.log.length > 0) return;

  const found = await readViewState();
  if (state.log.length > 0) return;

  if (!found || found.tabs.length === 0) {
    state.sync = "saved";
    return;
  }

  for (const record of [...state.tabs.tabs]) {
    state.tabs.remove(record.id);
    state.views.forget(record.id);
  }

  for (const record of found.tabs) {
    const view = found.views[record.id];
    if (view === undefined) continue;
    state.views.set(record.id, view);
    state.tabs.add(record);
  }

  state.tabs.activate(found.activeId);
  if (state.tabs.find(state.tabs.activeId) === undefined) {
    state.tabs.activate(state.tabs.tabs[0].id);
  }

  state.revision = found.revision;
  state.sync = "saved";
};

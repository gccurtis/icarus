import { readWorkspaceState } from "$capabilities/workspace/index.remote";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

/**
 * Replace what is open with what the server holds.
 *
 * The read is the rebase: a workspace does not lag, so re-stating an op against
 * the state it was refused over means holding that state first.
 */
export const adopt = async (
  state: WorkspaceStateData,
  stillWanted: () => boolean = () => true
): Promise<boolean> => {
  const found = await readWorkspaceState();
  if (!stillWanted()) return false;
  if (!found || found.tabs.length === 0) return false;

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

  return true;
};

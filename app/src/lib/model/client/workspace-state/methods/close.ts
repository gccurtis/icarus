import type { TabId } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { isSingleton } from "$model/client/workspace-state/methods/shared/defaults";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const close = (state: WorkspaceStateData, id: TabId): void => {
  const at = state.tabs.indexOf(id);
  if (at < 0) return;

  const record = state.tabs.tabs[at];
  if (isSingleton(record.screen)) {
    throw new Error(`'${record.screen}' is one per project and cannot be closed`);
  }

  if (state.tabs.activeId === id) {
    perform(state, {
      op: "activate",
      was: id,
      now: state.tabs.tabs[Math.max(0, at - 1)].id
    });
  }

  perform(state, {
    op: "close",
    tab: id,
    at,
    target: { screen: record.screen, resourceId: record.resourceId },
    view: state.views.of(id)
  });
};

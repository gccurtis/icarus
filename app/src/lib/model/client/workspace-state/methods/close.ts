import type { TabId } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { isSingleton } from "$model/client/workspace-state/methods/shared/defaults";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const close = (state: WorkspaceStateData, id: TabId): void => {
  const at = state.tabs.indexOf(id);
  if (at < 0) return;

  const record = state.tabs.tabs[at];
  if (isSingleton(record.category)) {
    throw new Error(`'${record.category}' is one per project and cannot be closed`);
  }

  if (state.tabs.activeId === id) {
    const projectOverview = state.tabs.tabs.find(
      (candidate) => candidate.category === "project-overview"
    );
    if (projectOverview === undefined) {
      throw new Error("Project Overview must be open.");
    }

    const remains = state.tabs.tabs.some(
      (candidate) => candidate.id !== id && !isSingleton(candidate.category)
    );
    const neighbour = state.tabs.tabs[at + 1] ?? state.tabs.tabs[at - 1];

    perform(state, {
      op: "activate",
      was: id,
      now: remains && neighbour !== undefined ? neighbour.id : projectOverview.id
    });
  }

  perform(state, {
    op: "close",
    tab: id,
    at,
    target: { category: record.category, resourceId: record.resourceId },
    view: state.views.of(id)
  });
};

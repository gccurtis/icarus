import { submitWorkspaceChanges } from "$capabilities/workspace/index.remote";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const submit = (state: WorkspaceStateData): Promise<void> => {
  state.pendingFlush ??= send(state).finally(() => {
    state.pendingFlush = undefined;
  });

  return state.pendingFlush;
};

const send = async (state: WorkspaceStateData): Promise<void> => {
  state.clearTimer();
  if (!state.persists || state.buffer.length === 0) return;

  const ops = state.buffer;
  state.buffer = [];
  state.sync = "saving";

  try {
    const accepted = await submitWorkspaceChanges({
      baseRevision: state.revision,
      ops,
      tabs: state.tabs.tabs.map((record) => ({
        id: record.id,
        category: record.category,
        resourceId: record.resourceId
      })),
      activeId: state.tabs.activeId,
      views: Object.fromEntries(
        state.tabs.tabs.map((record) => [record.id, { ...state.views.of(record.id) }])
      )
    });

    state.revision = accepted.revision;
    state.sync = state.buffer.length === 0 ? "saved" : "saving";
  } catch (error) {
    state.buffer = [...ops, ...state.buffer];
    state.sync = "error";

    throw error;
  }
};

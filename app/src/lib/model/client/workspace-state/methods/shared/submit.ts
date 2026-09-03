import { submitWorkspaceChanges } from "$capabilities/workspace/index.remote";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { adopt } from "$model/client/workspace-state/methods/shared/adopt";

export const submit = (state: WorkspaceStateData): Promise<void> => {
  state.pendingFlush ??= send(state).finally(() => {
    state.pendingFlush = undefined;
  });

  return state.pendingFlush;
};

const sent = (state: WorkspaceStateData, ops: readonly WorkspaceOp[]) => ({
  changeSet: { baseRevision: state.revision, ops }
});

const send = async (state: WorkspaceStateData): Promise<void> => {
  state.clearTimer();
  if (!state.persists || state.buffer.length === 0) return;

  const ops = state.buffer;
  state.buffer = [];
  state.sync = "saving";

  try {
    const answer = await submitWorkspaceChanges(sent(state, ops));

    if (answer.accepted) {
      state.revision = answer.revision;
      state.sync = state.buffer.length === 0 ? "saved" : "saving";
      return;
    }

    state.revision = answer.revision;
    state.sync = "rebasing";

    await adopt(state);

    const retried = await submitWorkspaceChanges(sent(state, ops));
    if (retried.accepted) {
      state.revision = retried.revision;
      state.sync = state.buffer.length === 0 ? "saved" : "saving";
      return;
    }

    await adopt(state);
    state.sync = "needs-review";
  } catch (error) {
    state.buffer = [...ops, ...state.buffer];
    state.sync = "error";

    throw error;
  }
};

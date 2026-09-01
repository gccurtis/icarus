import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { apply } from "$model/client/workspace-state/methods/shared/apply";
import { submit } from "$model/client/workspace-state/methods/shared/submit";

export const perform = (state: WorkspaceStateData, op: WorkspaceOp): void => {
  apply(state, op);

  state.log.push(op);
  if (state.undone.length > 0) state.undone = [];

  if (!state.persists) return;

  state.buffer = [...state.buffer, op];
  const send = () => void submit(state).catch(() => undefined);

  if (state.buffer.length >= state.afterOps) send();
  else state.armTimer(send);
};

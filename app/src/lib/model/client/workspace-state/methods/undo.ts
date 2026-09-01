import { invert } from "$representation/data/behavior/workspace/invert";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { apply } from "$model/client/workspace-state/methods/shared/apply";

export const undo = (state: WorkspaceStateData): void => {
  const op = state.log.pop();
  if (op === undefined) return;

  apply(state, invert(op));
  state.undone = [...state.undone, op];
};

import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { apply } from "$model/client/view-state/methods/shared/apply";

export const redo = (state: ViewStateData): void => {
  const op = state.undone.at(-1);
  if (op === undefined) return;

  state.undone = state.undone.slice(0, -1);
  apply(state, op);
  state.log.push(op);
};

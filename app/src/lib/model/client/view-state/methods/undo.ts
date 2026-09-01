import { invert } from "$representation/data/behavior/views/invert";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { apply } from "$model/client/view-state/methods/shared/apply";

export const undo = (state: ViewStateData): void => {
  const op = state.log.pop();
  if (op === undefined) return;

  apply(state, invert(op));
  state.undone = [...state.undone, op];
};

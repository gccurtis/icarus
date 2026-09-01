import type { ViewOp } from "$representation/data/types/views/op";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { apply } from "$model/client/view-state/methods/shared/apply";
import { submit } from "$model/client/view-state/methods/shared/submit";

export const perform = (state: ViewStateData, op: ViewOp): void => {
  apply(state, op);

  state.log.push(op);
  if (state.undone.length > 0) state.undone = [];

  if (!state.persists) return;

  state.buffer = [...state.buffer, op];
  const send = () => void submit(state).catch(() => undefined);

  if (state.buffer.length >= state.afterOps) send();
  else state.armTimer(send);
};

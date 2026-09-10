import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const armResearchDeadline = (
  state: OperationFlightsState,
  turnId: string,
  ms: number
): (() => void) => {
  const held = state.research.get(turnId);
  if (held === undefined) throw new Error("research flight is not active");
  if (held.deadline !== undefined) clearTimeout(held.deadline);
  const timer = setTimeout(() => {
    if (state.research.get(turnId) !== held) return;
    held.reason ??= "deadline";
    held.controller.abort();
  }, ms);
  held.deadline = timer;
  return () => {
    if (held.deadline !== timer) return;
    clearTimeout(timer);
    held.deadline = undefined;
  };
};

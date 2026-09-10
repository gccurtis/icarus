import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const endResearch = (state: OperationFlightsState, turnId: string): void => {
  const held = state.research.get(turnId);
  if (held?.deadline !== undefined) clearTimeout(held.deadline);
  state.research.delete(turnId);
  held?.settle();
};

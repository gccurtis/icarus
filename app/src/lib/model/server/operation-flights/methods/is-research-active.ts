import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const isResearchActive = (
  state: OperationFlightsState,
  turnId: string
): boolean => state.research.has(turnId);

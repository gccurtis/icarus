import type { OperationFlightsState } from "$model/server/operation-flights/definition";
import { researchHandle } from "$model/server/operation-flights/methods/shared/research-handle";
import type { ResearchFlight } from "$model/server/operation-flights/types";

export const research = (
  state: OperationFlightsState,
  turnId: string
): ResearchFlight | undefined => {
  const held = state.research.get(turnId);
  return held === undefined ? undefined : researchHandle(held);
};

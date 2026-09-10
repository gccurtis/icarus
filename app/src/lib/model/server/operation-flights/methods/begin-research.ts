import type { HeldResearchFlight, OperationFlightsState } from "$model/server/operation-flights/definition";
import { assertOpen } from "$model/server/operation-flights/methods/shared/assert-open";
import { researchHandle } from "$model/server/operation-flights/methods/shared/research-handle";
import type { ResearchFlight } from "$model/server/operation-flights/types";

export const beginResearch = (
  state: OperationFlightsState,
  turnId: string
): ResearchFlight => {
  assertOpen(state);
  const held: HeldResearchFlight = {
    controller: new AbortController(),
    stopping: false
  };
  state.research.set(turnId, held);
  return researchHandle(held);
};

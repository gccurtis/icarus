import type { HeldResearchFlight, OperationFlightsState } from "$model/server/operation-flights/definition";
import { assertOpen } from "$model/server/operation-flights/methods/shared/assert-open";
import { researchHandle } from "$model/server/operation-flights/methods/shared/research-handle";
import type { ResearchFlight } from "$model/server/operation-flights/types";

export const beginResearch = (
  state: OperationFlightsState,
  turnId: string
): ResearchFlight => {
  assertOpen(state);
  if (state.research.has(turnId)) {
    throw new Error(`research flight ${turnId} is already active`);
  }
  let settle!: () => void;
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const held: HeldResearchFlight = {
    controller: new AbortController(),
    settled,
    settle,
    stopping: false
  };
  state.research.set(turnId, held);
  return researchHandle(held);
};

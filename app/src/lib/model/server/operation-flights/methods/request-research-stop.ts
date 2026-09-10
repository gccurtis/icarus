import type { OperationFlightsState } from "$model/server/operation-flights/definition";
import type { ResearchStopOutcome } from "$model/server/operation-flights/types";

export const requestResearchStop = (
  state: OperationFlightsState,
  turnId: string
): ResearchStopOutcome => {
  const held = state.research.get(turnId);
  if (held === undefined) return "missing";
  if (!held.stopping) {
    held.stopping = true;
    return "answering";
  }
  held.reason ??= "cancelled";
  held.controller.abort();
  return "cancelled";
};

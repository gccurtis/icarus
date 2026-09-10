import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const close = (state: OperationFlightsState): void => {
  if (state.closed) return;
  state.closed = true;
  for (const flight of state.derived.values()) flight.controller.abort();
  for (const flight of state.research.values()) {
    if (flight.deadline !== undefined) clearTimeout(flight.deadline);
    flight.reason ??= "shutdown";
    flight.controller.abort();
  }
  state.derived.clear();
  state.research.clear();
};

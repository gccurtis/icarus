import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const assertOpen = (state: OperationFlightsState): void => {
  if (state.closed) throw new Error("operation flights are closed");
};

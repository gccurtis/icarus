import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const updateDerivedRequestKey = (
  state: OperationFlightsState,
  key: string,
  requestKey: string
): void => {
  const flight = state.derived.get(key);
  if (flight !== undefined) flight.requestKey = requestKey;
};

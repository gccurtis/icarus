import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const derivedRequestKey = (
  state: OperationFlightsState,
  key: string
): string | undefined => state.derived.get(key)?.requestKey;

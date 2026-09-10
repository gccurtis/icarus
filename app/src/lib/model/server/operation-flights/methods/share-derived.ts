import type { DerivedFlight, OperationFlightsState } from "$model/server/operation-flights/definition";
import { assertOpen } from "$model/server/operation-flights/methods/shared/assert-open";

export const shareDerived = <T>(
  state: OperationFlightsState,
  key: string,
  requestKey: string,
  run: (signal: AbortSignal) => Promise<T>
): { readonly started: boolean; readonly promise: Promise<T> } => {
  assertOpen(state);
  const active = state.derived.get(key);
  if (active !== undefined) {
    // A key names one operation/result type. The caller owns that correlation
    // invariant, so this lifetime owner does not import capability result types.
    return { started: false, promise: active.promise as Promise<T> };
  }

  const controller = new AbortController();
  const promise = Promise.resolve().then(async () => await run(controller.signal));
  const flight: DerivedFlight = { controller, promise, requestKey };
  state.derived.set(key, flight);
  const release = () => {
    if (state.derived.get(key) === flight) state.derived.delete(key);
  };
  void promise.then(release, release);
  return { started: true, promise };
};

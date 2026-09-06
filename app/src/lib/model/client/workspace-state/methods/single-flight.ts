import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import type { SingleFlightKeyPart } from "$model/client/workspace-state/types";

/**
 * Return the pending promise for an identical durable intent, or start it once.
 *
 * `run` begins in a microtask after registration. Besides turning a synchronous
 * throw into a rejection, that ordering prevents a command which immediately
 * re-enters a second surface from passing the registry before its own entry is
 * visible. Either outcome releases the key so a deliberate retry can proceed.
 */
export const singleFlight = <Result>(
  state: WorkspaceStateData,
  key: readonly SingleFlightKeyPart[],
  run: () => PromiseLike<Result>
): Promise<Result> => {
  const encoded = JSON.stringify(key);
  const current = state.pendingFlights.get(encoded) as Promise<Result> | undefined;
  if (current !== undefined) return current;

  const started = Promise.resolve().then(run);
  state.pendingFlights.set(encoded, started);

  const release = () => {
    if (state.pendingFlights.get(encoded) === started) state.pendingFlights.delete(encoded);
  };
  void started.then(release, release);

  return started;
};

import type { OperationFlightsState } from "$model/server/operation-flights/definition";
import { OperationFlightsShutdownError } from "$model/server/operation-flights/types";

/**
 * Stops accepting work, aborts every owned operation, then drains it.
 *
 * Aborting is only the request to stop. The capability can still have a catch
 * or finally block which persists its terminal state. Waiting for those blocks
 * is what makes it safe for the browser harness to replace its Store after this
 * promise resolves, and keeps observability alive through production shutdown.
 */
export const close = (state: OperationFlightsState): Promise<void> => {
  if (state.closePromise !== undefined) return state.closePromise;
  state.closed = true;

  let finish!: () => void;
  const closePromise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  state.closePromise = closePromise;

  const pending = [
    ...[...state.derived.values()].map((flight) => flight.promise),
    ...[...state.research.values()].map((flight) => flight.settled),
    ...[...state.agentTasks.values()].map((flight) => flight.promise)
  ];
  for (const flight of state.derived.values()) {
    flight.controller.abort(new OperationFlightsShutdownError());
  }
  for (const flight of state.research.values()) {
    if (flight.deadline !== undefined) clearTimeout(flight.deadline);
    flight.reason ??= "shutdown";
    flight.controller.abort();
  }
  for (const flight of state.agentTasks.values()) {
    clearTimeout(flight.deadline);
    flight.controller.abort(new OperationFlightsShutdownError());
  }
  void Promise.allSettled(pending).then(() => {
    state.derived.clear();
    state.research.clear();
    state.agentTasks.clear();
    finish();
  });
  return closePromise;
};

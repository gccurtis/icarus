import type { OperationFlightsState } from "$model/server/operation-flights/definition";
import { assertOpen } from "$model/server/operation-flights/methods/shared/assert-open";
import {
  AgentTaskDeadlineError,
  type AgentTaskFlight
} from "$model/server/operation-flights/types";

/** Own one Agent task promise, cancellation signal and deadline per process. */
export const runAgentTask = <T>(
  state: OperationFlightsState,
  taskId: string,
  deadlineMs: number,
  run: (signal: AbortSignal) => Promise<T>
): AgentTaskFlight<T> => {
  assertOpen(state);
  const active = state.agentTasks.get(taskId);
  if (active !== undefined) {
    return { started: false, promise: active.promise as Promise<T> };
  }
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1) {
    throw new Error("an Agent task deadline must be a positive integer");
  }

  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(new AgentTaskDeadlineError()),
    deadlineMs
  );
  const promise = Promise.resolve().then(async () => await run(controller.signal));
  const held = { controller, deadline, promise };
  state.agentTasks.set(taskId, held);
  const release = () => {
    clearTimeout(deadline);
    if (state.agentTasks.get(taskId) === held) state.agentTasks.delete(taskId);
  };
  void promise.then(release, release);
  return { started: true, promise };
};

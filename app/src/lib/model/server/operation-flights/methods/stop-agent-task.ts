import type { OperationFlightsState } from "$model/server/operation-flights/definition";
import { AgentTaskCancelledError } from "$model/server/operation-flights/types";

/** Immediately stop one active Agent task; durable state remains the capability's. */
export const stopAgentTask = (
  state: OperationFlightsState,
  taskId: string
): boolean => {
  const held = state.agentTasks.get(taskId);
  if (held === undefined) return false;
  held.controller.abort(new AgentTaskCancelledError());
  return true;
};

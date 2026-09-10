import type { OperationFlightsState } from "$model/server/operation-flights/definition";

export const isAgentTaskActive = (
  state: OperationFlightsState,
  taskId: string
): boolean => state.agentTasks.has(taskId);

import type { JobSchedulerState } from "#workflows/types.js";

export interface QueueStatusCapabilityInput {
  queues: JobSchedulerState;
  registeredEndpoints: string[];
}

export const runQueueStatusCapability = async (
  input: QueueStatusCapabilityInput
): Promise<QueueStatusCapabilityInput> => input;

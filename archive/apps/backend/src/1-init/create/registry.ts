import { JobRegistry } from "#utils/jobs/registry.js";
import { JobScheduler } from "#utils/jobs/scheduler.js";
import { registerEndpointMappings } from "#job-wiring/internal/registerEndpointMappings.js";

export const createRegistry = (scheduler: JobScheduler): JobRegistry => {
  // Build one process-wide endpoint registry, then load every job-wiring group.
  const registry = new JobRegistry();
  registerEndpointMappings(registry, scheduler);
  return registry;
};

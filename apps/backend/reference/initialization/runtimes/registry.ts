import { JobRegistry } from "#workflows/registry.js";
import { JobScheduler } from "#workflows/scheduler.js";
import { registerEndpointMappings } from "#api/routes/internal/registerEndpointMappings.js";

export const createRegistry = (scheduler: JobScheduler): JobRegistry => {
  // Build one process-wide endpoint registry, then load every job-wiring group.
  const registry = new JobRegistry();
  registerEndpointMappings(registry, scheduler);
  return registry;
};

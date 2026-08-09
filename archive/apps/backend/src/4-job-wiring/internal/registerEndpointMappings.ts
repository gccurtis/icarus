import { JobRegistry } from "#utils/jobs/registry.js";
import { JobScheduler } from "#utils/jobs/scheduler.js";
import { registerBuiltInEndpointMappings } from "#job-wiring/registerBuiltInEndpointMappings.js";

export const registerEndpointMappings = (
  registry: JobRegistry,
  scheduler: JobScheduler
): void => {
  // Keep initialization stable: it calls this one function while this file
  // fans out to each endpoint-registration group added under job wiring.
  registerBuiltInEndpointMappings(registry, scheduler);
};

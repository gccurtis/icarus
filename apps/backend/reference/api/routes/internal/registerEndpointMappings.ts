import { JobRegistry } from "#workflows/registry.js";
import { JobScheduler } from "#workflows/scheduler.js";
import { registerBuiltInEndpointMappings } from "#api/routes/registerBuiltInEndpointMappings.js";

export const registerEndpointMappings = (
  registry: JobRegistry,
  scheduler: JobScheduler
): void => {
  // Keep initialization stable: it calls this one function while this file
  // fans out to each endpoint-registration group added under job wiring.
  registerBuiltInEndpointMappings(registry, scheduler);
};

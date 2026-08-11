import { RouteRegistry } from "#api/routes/registry.js";
import { registerBuiltInRoutes } from "#api/routes/registerBuiltInRoutes.js";

export const createRegistry = (): RouteRegistry => {
  // Build one process-wide route table, then load each route group. A capability
  // returning from reference/ adds its own registration call here.
  const registry = new RouteRegistry();
  registerBuiltInRoutes(registry);
  return registry;
};

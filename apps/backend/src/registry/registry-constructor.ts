import { registerBuiltInRoutes } from "#registry/registrations/built-in.js";
import { RouteRegistry } from "#registry/registry.js";

/** Creates the one route registry for one backend runtime. */
export const createRegistry = (): RouteRegistry => {
  const registry = new RouteRegistry();
  registerBuiltInRoutes(registry);
  return registry;
};

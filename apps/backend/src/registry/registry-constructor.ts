import { registerBuiltInEndpoints } from "#built-in";
import { RouteRegistry } from "#registry/registry.js";

/** Creates the one endpoint registry for one backend runtime. */
export const createRegistry = (): RouteRegistry => {
  const registry = new RouteRegistry();
  registerBuiltInEndpoints(registry);
  return registry;
};

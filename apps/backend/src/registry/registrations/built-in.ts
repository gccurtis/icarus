import { runEchoCapability } from "#capabilities/built-in/echoCapability.js";
import { runHealthCapability } from "#capabilities/built-in/healthCapability.js";
import type { RouteRegistry } from "#registry/registry.js";

/** Registers the operational routes available without another capability wired. */
export const registerBuiltInRoutes = (registry: RouteRegistry): void => {
  registry.register({ method: "GET", path: "/health" }, async () => ({
    statusCode: 200,
    body: await runHealthCapability()
  }));

  registry.register({ method: "POST", path: "/echo" }, async (request) => ({
    statusCode: 200,
    body: await runEchoCapability({
      method: request.method,
      path: request.path,
      body: request.body
    })
  }));
};

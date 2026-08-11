import { runEchoCapability } from "#capabilities/built-in/echoCapability.js";
import { runHealthCapability } from "#capabilities/built-in/healthCapability.js";
import type { RouteRegistry } from "#api/routes/registry.js";

/**
 * The operational routes the backend serves with no capability wired.
 *
 * Two of the original four are in `reference/`: `/health/queues` reported job
 * queue state, and `/audit` existed to exercise deferred serial execution. Both
 * described a job system that no longer runs.
 */
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

import { echoJob } from "#built-in/endpoints/echo/job.js";
import { healthJob } from "#built-in/endpoints/health/job.js";
import type { RouteRegistry } from "#registry/registry.js";

/**
 * Registers the operational endpoint jobs available before any other capability
 * is wired. Registration only — the jobs decide their own responses.
 */
export const registerBuiltInEndpoints = (registry: RouteRegistry): void => {
  registry.register({ method: "GET", path: "/health" }, healthJob);
  registry.register({ method: "POST", path: "/echo" }, echoJob);
};

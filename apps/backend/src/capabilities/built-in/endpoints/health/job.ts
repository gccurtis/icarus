import type { EndpointJob } from "#registry/registry.js";

/**
 * The health payload this backend serves. The backend owns this shape because it
 * produces it; consumers declare their own expectation of the wire format.
 */
export interface ApiHealth {
  service: "backend";
  status: "ok";
  timestamp: string;
}

/**
 * `GET /health`. It admits no input, so it has no `wire/`: the request envelope
 * is never read. The answer is the process identity plus the moment it was
 * produced — no database, provider, or scheduler readiness is inspected.
 */
export const healthJob: EndpointJob = async () => {
  const body: ApiHealth = {
    service: "backend",
    status: "ok",
    timestamp: new Date().toISOString()
  };

  return { statusCode: 200, body };
};

export interface RequestEndpoint {
  method: string;
  path: string;
}

/**
 * Transport data captured from the framework request before it is normalized.
 * Keeping this type here prevents endpoint jobs from depending on Fastify types.
 */
export interface IncomingRequest {
  id: string;
  method: string;
  url: string;
  query: unknown;
  headers: Record<string, unknown>;
  body: unknown;
}

/**
 * The framework-neutral request passed to a registered endpoint job.
 *
 * There is no `params`, and none is planned: identity travels in the JSON body,
 * so every value reaching a runtime method has passed through one endpoint's
 * `wire/decode.ts`. A path parameter would arrive as a raw string from the
 * router and need a second validation route to the same place. `types.md` has
 * the full reasoning, including what it costs.
 */
export interface RequestEnvelope extends RequestEndpoint {
  requestId?: string;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}

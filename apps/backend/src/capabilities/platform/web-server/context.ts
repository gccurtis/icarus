export interface RequestEndpoint {
  method: string;
  path: string;
}

/**
 * Transport data captured from the framework request before it is normalized.
 * Keeping this type here prevents route work from depending on Fastify types.
 */
export interface IncomingRequest {
  id: string;
  method: string;
  url: string;
  params: unknown;
  query: unknown;
  headers: Record<string, unknown>;
  body: unknown;
}

/** The framework-neutral request passed to a registered route work function. */
export interface RequestEnvelope extends RequestEndpoint {
  requestId?: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}

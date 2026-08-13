import type { EchoRequest } from "#built-in/endpoints/echo/wire/request.js";
import type { RequestEnvelope } from "#web-server";

/**
 * Admits one echo request.
 *
 * Echo exists to reflect whatever it is sent, so admission is permissive: no key
 * is required and no value is rejected. The step is still real — it copies the
 * three values the endpoint reflects out of the untrusted envelope into a fresh
 * request value, so the job never reads the envelope and never gains access to
 * headers, query, or params it does not echo.
 */
export const decodeEchoRequest = (envelope: RequestEnvelope): EchoRequest => ({
  method: envelope.method,
  path: envelope.path,
  body: envelope.body
});

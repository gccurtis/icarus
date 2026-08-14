import { decodeEchoRequest } from "#built-in/endpoints/echo/wire/decode.js";
import type { EchoResponse } from "#built-in/endpoints/echo/wire/response.js";
import type { EndpointJob } from "#registry";

/**
 * `POST /echo`. It reflects the admitted method, path, and body, and stamps the
 * moment it answered. There is no runtime object behind it and no state to
 * touch, so the job is the whole procedure.
 */
export const echoJob: EndpointJob = async (request) => {
  const admitted = decodeEchoRequest(request);

  const body: EchoResponse = {
    method: admitted.method,
    path: admitted.path,
    body: admitted.body,
    processedAt: new Date().toISOString()
  };

  return { statusCode: 200, body };
};

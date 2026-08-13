import type { FastifyInstance } from "fastify";
import type { ListenAddress } from "#web-server/types/listen-address.js";

/**
 * Binds the server and resolves with the address it is actually listening on,
 * which differs from the requested one when port 0 asks for an ephemeral port.
 */
export const listenForRequests = (
  app: FastifyInstance,
  address: ListenAddress
): Promise<string> => app.listen(address);

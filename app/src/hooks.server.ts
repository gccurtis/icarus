import type { Handle, ServerInit } from "@sveltejs/kit";
import { closeServerModel, initServerModel, serverModel } from "$model/server/index.server";
import { resolveSession } from "$model/server/scope.server";

/**
 * Builds the one server graph, before this process answers its first request.
 *
 * This is the whole of the model's construction, and it happens once. A request
 * is the wrong moment: it would make the first caller pay for configuration,
 * logging, and the database registry, and it would mean concurrent first
 * requests could race to open the same log file — which is why the door used to
 * carry an in-flight promise cache and a failed-build eviction, and why neither
 * exists any more.
 *
 * A configuration error now fails startup rather than one unlucky request.
 */
export const init: ServerInit = async () => {
  await initServerModel();
};

/**
 * Per request: hand the already-built model to the request, then resolve who is
 * asking.
 *
 * **Authority only.** This runs before any handler has parsed a request body,
 * and a call's project arrives in that body — a remote function cannot be
 * reached by a route that names the project, because kit serves every remote
 * call from `/_app/remote/…` with empty route params. So a scope is assembled
 * one layer down, by the remote wrapper that holds both the session and the
 * token; see `scope.server.ts`.
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.model = serverModel();
  event.locals.session = await resolveSession(event.cookies);

  return resolve(event);
};

/**
 * Release what the model holds, after the server has stopped accepting work.
 *
 * `sveltekit:shutdown` rather than SIGTERM: the Node adapter installs its own
 * signal handler that closes the listener, drains in-flight requests, and only
 * then emits this event. Releasing on the raw signal would pull what the model
 * holds out from under requests still being served — today that is the log
 * stream, and a record written after close is a record nobody reads.
 *
 * `once` is wrong here for the same reason: the adapter's handler is permanent,
 * so a second signal never reaches Node's default disposition anyway.
 */
process.on("sveltekit:shutdown", () => {
  void closeServerModel().catch((error: unknown) => {
    process.exitCode = 1;
    console.error("model shutdown failed", error);
  });
});

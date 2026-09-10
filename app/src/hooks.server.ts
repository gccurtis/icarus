import { getEventListeners } from "node:events";
import type { Handle, ServerInit } from "@sveltejs/kit";
import {
  initServerModel,
  ownServerModelLifetime,
  serverModel
} from "$runtime/server/start.server";
import { resolveSession } from "$runtime/server/scope.server";
import { serverInitialization } from "$runtime/server/initialization.server";

const reportShutdownFailure = (error: unknown) => {
  process.exitCode = 1;
  console.error("model shutdown failed", error);
};

/**
 * Release what the model holds after the adapter has stopped accepting work.
 * During development, replacement removes this exact listener and releases its
 * current graph before the incoming hook initializes. Raw process listeners
 * otherwise survive Vite invalidation and accumulate across source changes.
 */
const releaseBeforeInitialization = ownServerModelLifetime(
  {
    listeners: () => getEventListeners(process, "sveltekit:shutdown").filter(
      (listener): listener is () => void => typeof listener === "function"
    ),
    add: (listener) => process.on("sveltekit:shutdown", listener),
    remove: (listener) => process.off("sveltekit:shutdown", listener)
  },
  reportShutdownFailure
);

/**
 * Builds the one server graph, before this process answers its first request.
 *
 * Repeated framework init calls join this hook module's one command. A new
 * module evaluation creates a new command after releasing the outgoing graph.
 * Configuration errors remain startup failures, not request-time retries.
 */
export const init: ServerInit = serverInitialization(
  releaseBeforeInitialization,
  () => initServerModel()
);

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

import type { Handle } from "@sveltejs/kit";
import { closeServerRuntime, serverRuntime } from "$runtime/server/index.server";
import { resolveSession } from "$runtime/server/scope.server";

/**
 * Per request: build the runtime if it is not built, then resolve who is asking.
 *
 * **Authority only.** This runs before any handler has parsed a request body,
 * and a call's project arrives in that body — a remote function cannot be
 * reached by a route that names the project, because kit serves every remote
 * call from `/_app/remote/…` with empty route params. So a scope is assembled
 * one layer down, by the remote wrapper that holds both the session and the
 * token; see `scope.server.ts`.
 *
 * The runtime is awaited eagerly because resolving a session needs
 * configuration, and every request resolves one. There is no lazy accessor: one
 * forced open on the line below where it is installed would be a comment
 * claiming a saving that does not happen.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const runtime = await serverRuntime();

  event.locals.runtime = runtime;
  event.locals.session = await resolveSession(event.cookies);

  return resolve(event);
};

/**
 * Release what the runtime holds, after the server has stopped accepting work.
 *
 * `sveltekit:shutdown` rather than SIGTERM: the Node adapter installs its own
 * signal handler that closes the listener, drains in-flight requests, and only
 * then emits this event. Tearing databases down on the raw signal would pull
 * them out from under requests still being served — and PGlite holds a WASM
 * instance and file handles per project, so a request querying after close
 * fails rather than degrades.
 *
 * `once` is wrong here for the same reason: the adapter's handler is permanent,
 * so a second signal never reaches Node's default disposition anyway.
 */
process.on("sveltekit:shutdown", () => {
  void closeServerRuntime().catch((error: unknown) => {
    process.exitCode = 1;
    console.error("runtime shutdown failed", error);
  });
});

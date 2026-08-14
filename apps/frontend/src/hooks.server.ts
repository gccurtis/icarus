import type { Handle } from "@sveltejs/kit";
import { closeServerRuntime, serverRuntime } from "$runtime/server/index.server";
import { resolveScope } from "$runtime/server/scope.server";

/**
 * Per request: build the runtime if it is not built, then resolve who is asking
 * and about which project.
 *
 * The runtime is awaited eagerly because scope resolution needs configuration,
 * and every request needs scope. There is no lazy accessor: one that is forced
 * open on the line below where it is installed would be a comment claiming a
 * saving that does not happen.
 *
 * Neither of `resolveScope`'s eventual inputs exists yet — there is no session
 * cookie to read a user from, and no `[project]` route to take a token from.
 * The seam is here rather than later because every capability procedure reads
 * `locals.scope`, and retrofitting it would touch all of them.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const runtime = await serverRuntime();

  event.locals.runtime = runtime;
  event.locals.scope = await resolveScope(runtime.configuration, undefined, undefined);

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

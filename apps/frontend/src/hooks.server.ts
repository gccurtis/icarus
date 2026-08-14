import type { Handle } from "@sveltejs/kit";
import { closeServerRuntime, serverRuntime } from "$runtime/server/index.server";
import { resolveScope } from "$runtime/server/scope.server";

/**
 * Per request: resolve who is asking and about which project, and hand the
 * request the runtime it may reach.
 *
 * `locals.runtime` is a resolver rather than a value, so a request touching no
 * capability builds nothing and pays nothing. `locals.scope` is resolved eagerly
 * because it is cheap and because everything downstream assumes it is there.
 *
 * Neither of `resolveScope`'s eventual inputs exists yet: there is no session
 * cookie to read a user from, and no `[project]` route to take a token from.
 * The seam is here rather than later because every capability procedure reads
 * `locals.scope`, and retrofitting it would touch all of them.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const runtime = await serverRuntime();

  event.locals.scope = await resolveScope(runtime.configuration, undefined, undefined);
  event.locals.runtime = () => serverRuntime();

  return resolve(event);
};

/**
 * Close open project databases on the way out.
 *
 * PGlite holds a WASM instance and file handles per project; a process that
 * exits without releasing them leaves directories that the next start has to
 * recover. `once` leaves a second signal to Node's forced exit, so a hung
 * shutdown can still be interrupted.
 */
const stop = (): void => {
  void closeServerRuntime().catch((error: unknown) => {
    process.exitCode = 1;
    console.error("runtime shutdown failed", error);
  });
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

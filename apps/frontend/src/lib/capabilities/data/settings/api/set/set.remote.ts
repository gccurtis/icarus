import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$runtime/server/scope.server";
import { set as setProcedure } from "$settings/api/set/set";
import { stated } from "$settings/api/shared/stated";
import type { SetRequest } from "$settings/types/requests";
import type { Setting } from "$settings/types/settings";

/**
 * Exposes `set` to the browser.
 *
 * A `command` rather than a `query`: it mutates, and kit refreshes queries after
 * one resolves.
 *
 * Admission is `'unchecked'`, so the procedure this calls is the only thing
 * between a hostile payload and the database — `canonicalKey` and
 * `canonicalValue` run on every path through it.
 *
 * The two lines below are the whole boundary. `resolveScope` turns the token the
 * client sent into a project *within this session's user*, or into a 404; below
 * that call the token no longer exists and `set` receives authority it cannot
 * have been talked out of.
 *
 * A `.remote.ts` may export only remote functions — the transform assigns an id
 * to every export, so a plain exported helper throws at module load. On the
 * client the body is discarded and regenerated as a fetch stub, which is why
 * importing the server tree from here is safe.
 */
export const set = command("unchecked", (request: SetRequest): Promise<Setting> =>
  stated(async () => {
    const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
    return setProcedure(scope, { key: request.key, value: request.value });
  })
);

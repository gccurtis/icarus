import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { define as defineProcedure } from "$name-manager/api/define/define";
import { stated } from "$name-manager/api/shared/stated";
import type { DefineRequest } from "$name-manager/types/requests";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Exposes `define` to the browser.
 *
 * A `command` rather than a `query`: it writes, and kit refreshes queries after
 * one resolves — which is what makes a `list()` on screen pick up a new
 * declaration without the view arranging it.
 *
 * Admission is `'unchecked'`, so the procedure this calls is the only thing
 * standing between the payload and the database. That is deliberate rather than
 * lax: `define`'s admission tree already checks the name, the declared type, and
 * the value against that type, and a schema layer above it would restate the
 * same rules in a second vocabulary that could drift.
 *
 * The two lines below are the whole boundary. `resolveScope` turns the token the
 * client sent into a project *within this session's user*, or into a 404; below
 * that call the token no longer exists and `define` receives authority it cannot
 * have been talked out of.
 *
 * A `.remote.ts` may export only remote functions — the transform assigns an id
 * to every export, so a plain exported helper throws at module load. On the
 * client the body is discarded and regenerated as a fetch stub, which is why
 * importing the server tree from here is safe.
 */
export const define = command("unchecked", (request: DefineRequest): Promise<NamedVariable> =>
  stated(async () => {
    const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
    return defineProcedure(scope, request.variable);
  })
);

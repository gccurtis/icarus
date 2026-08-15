import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { get as getProcedure } from "$settings/api/get/get";
import { stated } from "$settings/api/shared/stated";
import type { GetRequest } from "$settings/types/requests";
import type { Setting } from "$settings/types/settings";

/**
 * Exposes `get` to the browser.
 *
 * Admission is `'unchecked'`, so the procedure this calls is the only thing
 * between a hostile payload and the database.
 *
 * `resolveScope` turns the token the client sent into a project within this
 * session's user, or into a 404. Below it the token no longer exists.
 */
export const get = query(
  "unchecked",
  (request: GetRequest): Promise<Setting | undefined> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return getProcedure(scope, request.key);
    })
);

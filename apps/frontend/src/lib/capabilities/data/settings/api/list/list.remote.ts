import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$runtime/server/scope.server";
import { list as listProcedure } from "$settings/api/list/list";
import { stated } from "$settings/api/shared/stated";
import type { ListRequest } from "$settings/types/requests";
import type { Setting } from "$settings/types/settings";

/**
 * Exposes `list` to the browser.
 *
 * Still takes a request object even though the project token is its only field.
 * A bare token argument would read as an ordinary string parameter at every call
 * site, and the point of the shape is that crossing this boundary means naming
 * which project you are talking about.
 */
export const list = query(
  "unchecked",
  (request: ListRequest): Promise<readonly Setting[]> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return listProcedure(scope);
    })
);

import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { list as listProcedure } from "$name-manager/api/list/list";
import { stated } from "$name-manager/api/shared/stated";
import type { ListRequest } from "$name-manager/types/requests";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Exposes `list` to the browser.
 *
 * A `query`, so a view can hold it and let kit refresh it when `define`
 * resolves. It carries the project token and nothing else — there is no filter
 * or page to pass, because the catalog is the project's whole set.
 */
export const list = query(
  "unchecked",
  (request: ListRequest): Promise<readonly NamedVariable[]> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return listProcedure(scope);
    })
);

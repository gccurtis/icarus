import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { require as requireProcedure } from "$name-manager/api/require/require";
import { stated } from "$name-manager/api/shared/stated";
import type { RequireRequest } from "$name-manager/types/requests";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Exposes `require` to the browser.
 *
 * The same lookup as [`get`](../get/get.md), for a caller that has nothing to
 * show if the name is absent. A view resolving a formula's references is the
 * case: it cannot render half an answer, so `variable-not-found` arriving as a
 * stated `400` is more useful to it than an `undefined` it would only turn into
 * the same message.
 *
 * Both are exposed because the choice belongs to the caller, and a browser that
 * can only reach `get` has to reimplement this one every time it needs it.
 */
export const require = query(
  "unchecked",
  (request: RequireRequest): Promise<NamedVariable> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return requireProcedure(scope, request?.name);
    })
);

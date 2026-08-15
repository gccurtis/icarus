import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { get as getProcedure } from "$name-manager/api/get/get";
import { stated } from "$name-manager/api/shared/stated";
import type { GetRequest } from "$name-manager/types/requests";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Exposes `get` to the browser.
 *
 * A `query`: it reads, so kit caches it, dedupes concurrent callers, and
 * refreshes it after a command resolves.
 *
 * `undefined` crosses the wire as an answer rather than an error — a browser
 * asking for a name that may not exist wants a branch, not a rejection.
 * [`require`](../require/require.md) is the other half of that choice.
 */
export const get = query(
  "unchecked",
  (request: GetRequest): Promise<NamedVariable | undefined> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return getProcedure(scope, request?.name);
    })
);

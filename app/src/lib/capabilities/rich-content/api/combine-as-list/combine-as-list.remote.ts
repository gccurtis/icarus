import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { combineAsList as combineAsListProcedure } from "$rich-content/api/combine-as-list/combine-as-list";
import { stated } from "$rich-content/api/shared/stated";
import type { CombineAsListRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `combineAsList` to the browser.
 *
 * Every id in `items` stops existing and one new object replaces them all, so a
 * view holding any of them has to drop all of them.
 *
 * See [`api.md`](../api.md) for the boundary the two lines below implement.
 */
export const combineAsList = command(
  "unchecked",
  (request: CombineAsListRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return combineAsListProcedure(scope, request);
    })
);

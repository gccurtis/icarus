import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { stated } from "$rich-content/api/shared/stated";
import { split as splitProcedure } from "$rich-content/api/split/split";
import type { SplitRequest } from "$rich-content/types/requests";
import type { SplitContentResult } from "$rich-content/types/results";

/**
 * Exposes `split` to the browser.
 *
 * The result names **two** objects, and the one the caller sent no longer
 * exists — a view holding the old id has to replace it with both, not add to it.
 *
 * See [`api.md`](../api.md) for the boundary the two lines below implement.
 */
export const split = command(
  "unchecked",
  (request: SplitRequest): Promise<SplitContentResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return splitProcedure(scope, request);
    })
);

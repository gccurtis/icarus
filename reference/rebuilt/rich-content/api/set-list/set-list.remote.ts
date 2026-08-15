import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { setList as setListProcedure } from "$rich-content/api/set-list/set-list";
import { stated } from "$rich-content/api/shared/stated";
import type { SetListRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `setList` to the browser. See [`api.md`](../api.md) for the boundary
 * the two lines below implement.
 */
export const setList = command(
  "unchecked",
  (request: SetListRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return setListProcedure(scope, request);
    })
);

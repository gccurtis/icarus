import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { removeList as removeListProcedure } from "$rich-content/api/remove-list/remove-list";
import { stated } from "$rich-content/api/shared/stated";
import type { RemoveListRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `removeList` to the browser. See [`api.md`](../api.md) for the
 * boundary the two lines below implement.
 */
export const removeList = command(
  "unchecked",
  (request: RemoveListRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return removeListProcedure(scope, request);
    })
);

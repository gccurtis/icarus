import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { removeLink as removeLinkProcedure } from "$rich-content/api/remove-link/remove-link";
import { stated } from "$rich-content/api/shared/stated";
import type { RemoveLinkRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `removeLink` to the browser. See [`api.md`](../api.md) for the
 * boundary the two lines below implement.
 */
export const removeLink = command(
  "unchecked",
  (request: RemoveLinkRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return removeLinkProcedure(scope, request);
    })
);

import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { setLink as setLinkProcedure } from "$rich-content/api/set-link/set-link";
import { stated } from "$rich-content/api/shared/stated";
import type { SetLinkRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `setLink` to the browser. See [`api.md`](../api.md) for the boundary
 * the two lines below implement.
 */
export const setLink = command(
  "unchecked",
  (request: SetLinkRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return setLinkProcedure(scope, request);
    })
);

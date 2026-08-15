import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { removeStyle as removeStyleProcedure } from "$rich-content/api/remove-style/remove-style";
import { stated } from "$rich-content/api/shared/stated";
import type { RemoveStyleRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `removeStyle` to the browser. See [`api.md`](../api.md) for the
 * boundary the two lines below implement.
 */
export const removeStyle = command(
  "unchecked",
  (request: RemoveStyleRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return removeStyleProcedure(scope, request);
    })
);

import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { applyStyle as applyStyleProcedure } from "$rich-content/api/apply-style/apply-style";
import { stated } from "$rich-content/api/shared/stated";
import type { ApplyStyleRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `applyStyle` to the browser. See [`api.md`](../api.md) for the
 * boundary the two lines below implement.
 */
export const applyStyle = command(
  "unchecked",
  (request: ApplyStyleRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return applyStyleProcedure(scope, request);
    })
);

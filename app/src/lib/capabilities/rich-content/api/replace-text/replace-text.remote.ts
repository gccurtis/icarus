import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { replaceText as replaceTextProcedure } from "$rich-content/api/replace-text/replace-text";
import { stated } from "$rich-content/api/shared/stated";
import type { ReplaceTextRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `replaceText` to the browser. See [`api.md`](../api.md) for the
 * boundary the two lines below implement.
 */
export const replaceText = command(
  "unchecked",
  (request: ReplaceTextRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return replaceTextProcedure(scope, request);
    })
);

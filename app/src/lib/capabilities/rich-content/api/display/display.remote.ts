import { getRequestEvent, query } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { display as displayProcedure } from "$rich-content/api/display/display";
import { stated } from "$rich-content/api/shared/stated";
import type { DisplayContent } from "$rich-content/types/display-content";
import type { DisplayRequest } from "$rich-content/types/requests";

/**
 * Exposes `display` to the browser. **The only query in this capability.**
 *
 * A `query` rather than a `command` because it reads — which also means kit
 * refreshes it whenever one of the ten commands resolves. That is the behaviour
 * an editor wants: every mutation returns only identity and a revision, and the
 * projection a view is rendering re-fetches itself.
 *
 * See [`api.md`](../api.md) for the boundary the two lines below implement.
 */
export const display = query(
  "unchecked",
  (request: DisplayRequest): Promise<DisplayContent> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return displayProcedure(scope, request?.contentId);
    })
);

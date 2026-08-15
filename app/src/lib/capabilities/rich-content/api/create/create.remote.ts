import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$model/server/scope.server";
import { create as createProcedure } from "$rich-content/api/create/create";
import { stated } from "$rich-content/api/shared/stated";
import type { CreateRequest } from "$rich-content/types/requests";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Exposes `create` to the browser.
 *
 * A `command` rather than a `query`: it writes. Ten of this capability's eleven
 * wrappers are commands, and only [`display`](../display/display.md) is a query
 * — which is the shape of a capability whose whole job is editing.
 *
 * The two lines inside `stated` are the whole boundary, and they are the same in
 * every wrapper here: `resolveScope` turns the token the client sent into a
 * project *within this session's user*, or into a 404, and below that call the
 * token no longer exists. [`api.md`](../api.md) explains it once rather than
 * eleven times.
 *
 * A `.remote.ts` may export only remote functions — the transform assigns an id
 * to every export, so a plain exported helper throws at module load. On the
 * client the body is discarded and regenerated as a fetch stub, which is why
 * importing the server tree from here is safe.
 */
export const create = command(
  "unchecked",
  (request: CreateRequest): Promise<ContentMutationResult> =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return createProcedure(scope, request?.initialText);
    })
);

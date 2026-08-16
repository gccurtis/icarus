import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import type { ResourceKey } from "$revisions/types/change";

/**
 * Anchors a resource at revision 0, which is what makes it readable at all.
 *
 * **Not registered, and called by whoever creates the resource**, inside the same
 * transaction — a document whose row committed without an anchor is a document
 * nothing can open, and a public `start` would let a client plant a body under
 * someone else's id.
 *
 * The body comes from the caller because what an empty one looks like is the
 * resource's own business; nothing here has ever inspected a body.
 *
 * **Both anchors are written, and only here.** Consolidation moves the leader
 * forward, leaving `base` as the sole anchor below it — and creation is the one
 * moment the body at revision 0 exists to be stored.
 */
export const start = async (
  ctx: MutationCtx,
  scope: Scope,
  resource: ResourceKey,
  body: unknown
): Promise<void> => {
  const at = Date.now();
  for (const role of ["base", "leader"] as const) {
    await ctx.db.insert("resourceSnapshots", {
      projectId: scope.projectId,
      ...resource,
      revision: 0,
      role,
      body,
      at
    });
  }
};

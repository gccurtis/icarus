import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { current } from "$revisions/api/shared/current";
import type { ResourceKey } from "$revisions/types/change";

/** What an editor opens: the body, and the revision to author the next change against. */
export type ResourceContent = {
  revision: number;
  body: unknown;
};

/**
 * A resource's current content: the leader snapshot with everything accepted
 * since folded onto it.
 *
 * The snapshot is not an optimization bolted on — it *is* the change sets already
 * folded, materialized so nobody folds them twice. Without one, opening a
 * document would replay every edit it ever had.
 *
 * `revision` is returned because a caller cannot author without it, and it is not
 * stored anywhere to be looked up: it is the last recent set's.
 */
export const read = async (
  ctx: QueryCtx,
  scope: Scope,
  resource: ResourceKey
): Promise<ResourceContent> => {
  const { leader, sets, revision } = await current(ctx, scope, resource);

  return { revision, body: applyOps(leader.body, sets.flatMap((set) => set.ops)) };
};

import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import { head } from "$revisions/api/shared/head";
import { check, touchedBy } from "$revisions/api/submit/check";
import { notFound } from "$revisions/errors";
import type { Op, ResourceKey } from "$revisions/types/change";
import type { Actor } from "$shared/types/actor";

/** A change as its author wrote it, against the revision they were looking at. */
export type AuthoredChange = ResourceKey & {
  baseRevision: number;
  ops: Op[];
};

/**
 * Accepts a change, or refuses it: read the current revision, decide the change
 * against everything that landed since its author last looked, append it above.
 *
 * **Nothing here is a compare-and-swap.** Convex mutations are serializable, so
 * a writer that commits `current + 1` first invalidates this one's read set and
 * this re-runs against the state that beat it. There is no version field and no
 * retry loop; the isolation level is the guarantee.
 *
 * The insert is the whole write. The resource row is untouched, the leader
 * snapshot is untouched, and nothing is patched — which is the point of keeping
 * the body and the revision off the resource row.
 *
 * **No activity entry.** An edit is a keystroke batch, and a feed of them would
 * bury everything a person would want to read there.
 *
 * **`by` is a parameter, not an argument.** The door builds the caller's own
 * actor from `ctx.scope`, so a browser cannot sign someone else's name to a
 * change; an agent editing during a task passes its own, because a task's edits
 * are attributed to the task and not to whoever dispatched it — which is what
 * keeps them out of that person's undo stack.
 */
export const submit = async (
  ctx: MutationCtx,
  scope: Scope,
  authored: AuthoredChange,
  by: Actor = { kind: "user", userId: scope.userId }
): Promise<{ revision: number }> => {
  const current = await head(ctx, scope, authored);
  // No head means no resource *here*: creating one writes its anchors, so
  // nothing that exists is without one.
  if (current === null) throw notFound(authored);

  const touched = touchedBy(authored.ops);
  const ops = await check(ctx, scope, { ...authored, touched }, current);
  const revision = current + 1;

  await ctx.db.insert("changeSets", {
    projectId: scope.projectId,
    resourceType: authored.resourceType,
    resourceId: authored.resourceId,
    revision,
    baseRevision: authored.baseRevision,
    tier: "recent",
    ops,
    touched,
    actor: by,
    at: Date.now()
  });

  return { revision };
};

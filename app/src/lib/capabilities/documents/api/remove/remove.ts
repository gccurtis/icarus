import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireDocument } from "$documents/api/shared/require-document";
import { discard } from "$revisions/api/shared/discard";

/**
 * Deletes a document. A real delete — archival is a project-level affordance and
 * this is not it.
 *
 * **The title is read before the row goes**, because the entry has to say which
 * document was deleted and there is nothing left to ask afterwards. That is the
 * whole reason activity stores labels rather than joining for them.
 *
 * **The body goes with the row, and it has to.** Revisions scopes a read off the
 * leader snapshot and a write off the head change set, so a document whose rows
 * outlived it would not merely be unreachable storage — it would stay readable
 * and editable by anyone still holding its id.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"documents">
): Promise<void> => {
  const { title } = await requireDocument(ctx, scope, id);

  await discard(ctx, { resourceType: "document", resourceId: id });
  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "document", id, label: title }
  });
};

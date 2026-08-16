import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireDocument } from "$documents/api/shared/require-document";

/**
 * Deletes a document. A real delete — archival is a project-level affordance and
 * this is not it.
 *
 * **The title is read before the row goes**, because the entry has to say which
 * document was deleted and there is nothing left to ask afterwards. That is the
 * whole reason activity stores labels rather than joining for them.
 *
 * The body is not deleted here because there is no body yet. Pass 2 adds the
 * leader snapshot and the change-set log, and removal has to take them with it —
 * a document's rows outliving the document would be unreachable storage.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"documents">
): Promise<void> => {
  const { title } = await requireDocument(ctx, scope, id);

  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "document", id, label: title }
  });
};

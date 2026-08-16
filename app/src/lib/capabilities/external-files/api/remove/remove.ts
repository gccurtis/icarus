import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireFile } from "$external-files/api/shared/require-file";

/**
 * Deletes a file, bytes included.
 *
 * **The stored blob goes with the row**, because a row is the only thing that
 * names it — an orphaned blob is storage nobody can reach and everybody pays
 * for.
 *
 * **The name is read before the row goes**, because the entry has to say which
 * file was deleted and there is nothing left to ask afterwards.
 *
 * A newer version's `supersedes` may point here and simply stop resolving. The
 * chain is history, not a dependency: the newer file is still whole.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"externalFiles">
): Promise<void> => {
  const { name, storageId } = await requireFile(ctx, scope, id);

  await ctx.storage.delete(storageId);
  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "externalFile", id, label: name }
  });
};

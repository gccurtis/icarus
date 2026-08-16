import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { discard } from "$revisions/api/shared/discard";
import { requireSpreadsheet } from "$spreadsheets/api/shared/require-spreadsheet";

/**
 * Deletes a workbook, and its sheets with it.
 *
 * **The body has to go too.** Revisions scopes a read off the leader snapshot
 * and a write off the head change set, neither of which knows this row exists —
 * so a workbook whose body outlived it would stay readable and editable by
 * anyone still holding its id.
 *
 * The title is read before the row goes, because the entry has to say which
 * workbook was deleted and there is nothing left to ask afterwards.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"spreadsheets">
): Promise<void> => {
  const { title } = await requireSpreadsheet(ctx, scope, id);

  await discard(ctx, { resourceType: "spreadsheet", resourceId: id });
  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "spreadsheet", id, label: title }
  });
};

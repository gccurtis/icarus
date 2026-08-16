import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";
import { requireSpreadsheet } from "$spreadsheets/api/shared/require-spreadsheet";
import { spreadsheetTitle } from "$spreadsheets/types/spreadsheet";

/**
 * Gives a workbook a different name.
 *
 * The workbook's title, not a sheet's: a sheet is named inside the body, where
 * renaming it is a change set like any other edit to the grid.
 */
export const rename = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"spreadsheets">,
  title: string
): Promise<void> => {
  await requireSpreadsheet(ctx, scope, id);
  const named = spreadsheetTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, { title: named, updatedBy: by, updatedAt: Date.now() });

  await record(ctx, scope, {
    actor: by,
    verb: "renamed",
    target: { type: "spreadsheet", id, label: named }
  });
};

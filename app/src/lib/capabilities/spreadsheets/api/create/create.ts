import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { start } from "$revisions/api/shared/start";
import type { Actor } from "$shared/types/actor";
import { emptySpreadsheetBody } from "$spreadsheets/types/body";
import { spreadsheetTitle } from "$spreadsheets/types/spreadsheet";

/**
 * Starts a workbook: a title, named styles, and no sheets.
 *
 * **The row and the anchor are written together**, because a workbook whose row
 * committed without one is a workbook nothing can open. What an empty body looks
 * like is decided here rather than in `revisions`, which has never inspected one.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  title: string,
  templateId?: string
): Promise<Id<"spreadsheets">> => {
  const named = spreadsheetTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("spreadsheets", {
    projectId: scope.projectId,
    title: named,
    templateId,
    createdBy: by,
    updatedBy: by,
    updatedAt: Date.now()
  });

  await start(ctx, scope, { resourceType: "spreadsheet", resourceId: id }, emptySpreadsheetBody());

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "spreadsheet", id, label: named }
  });

  return id;
};

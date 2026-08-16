import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { SpreadsheetsError } from "$spreadsheets/errors";

/**
 * The workbook that id names, or a refusal — and the two cases every function
 * taking a workbook id starts with.
 *
 * **Not found, never forbidden.** A workbook in another project answers exactly
 * as one that never existed. The gate proved the caller holds *a* project; this
 * is what proves the row is in it.
 */
export const requireSpreadsheet = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"spreadsheets">
): Promise<Doc<"spreadsheets">> => {
  const spreadsheet = await ctx.db.get(id);
  if (!spreadsheet || spreadsheet.projectId !== scope.projectId) {
    throw new SpreadsheetsError("not-found", `Workbook not found: ${id}`);
  }
  return spreadsheet;
};

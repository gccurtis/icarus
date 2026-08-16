import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";
import { SpreadsheetsError } from "$spreadsheets/errors";

/**
 * A workbook as a list, a tab, or a search result sees it: everything but the
 * grid.
 *
 * Nothing about the sheets is here — not their number, not their names. Both are
 * edited, and everything edited is in the body where an undo reaches it.
 */
export type Spreadsheet = {
  readonly id: Id<"spreadsheets">;
  readonly title: string;
  /** What it was made from, if anything. Provenance; the copy is already full. */
  readonly templateId?: string;
  readonly createdBy: Actor;
  readonly updatedBy: Actor;
  readonly updatedAt: number;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * A workbook is reached by name in every surface that lists one. What to call an
 * unnamed one is the client's decision — refusing here is what stops the
 * capability inventing "Untitled" on its behalf.
 */
export const spreadsheetTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new SpreadsheetsError("empty-title", "A workbook title cannot be empty");
  }
  return trimmed;
};

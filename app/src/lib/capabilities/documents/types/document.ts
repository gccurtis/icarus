import type { Id } from "$convex/_generated/dataModel";
import { DocumentsError } from "$documents/errors";
import type { Actor } from "$shared/types/actor";

/**
 * A document as a list, a tab, or a search result sees it: everything but the
 * content.
 *
 * No `revision` and no body, because neither is on the row this is built from —
 * the current revision is the highest change set's, read from an index in pass
 * 2, and asking for it here would make a cheap list read a per-row lookup.
 */
export type Document = {
  readonly id: Id<"documents">;
  readonly title: string;
  /** What it was made from, if anything. Provenance; the copy is already full. */
  readonly templateId?: Id<"templates">;
  readonly createdBy: Actor;
  readonly updatedBy: Actor;
  readonly updatedAt: number;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * A document is reached by name in every surface that lists one, so a blank
 * title is a row nobody can pick out. What to call an unnamed document is the
 * client's decision — refusing here is what stops the capability inventing
 * "Untitled" on its behalf.
 */
export const documentTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new DocumentsError("empty-title", "A document title cannot be empty");
  }
  return trimmed;
};

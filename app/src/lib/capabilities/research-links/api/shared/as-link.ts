import type { Doc } from "$convex/_generated/dataModel";
import type { ResearchLink } from "$research-links/types/research-link";

/**
 * The stored edge as a caller reads it.
 *
 * `projectId` stops here — the caller asked about the project they hold — and
 * `_creationTime` becomes `at`, which is the recency a view sorts evidence by
 * instead of a `rank` somebody would have to maintain.
 */
export const asLink = (row: Doc<"researchLinks">): ResearchLink => ({
  id: row._id,
  bearerKind: row.bearerKind,
  bearerId: row.bearerId,
  subjectKind: row.subjectKind,
  subjectId: row.subjectId,
  bearing: row.bearing,
  note: row.note,
  createdBy: row.createdBy,
  at: row._creationTime
});

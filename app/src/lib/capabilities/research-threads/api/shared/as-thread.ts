import type { Doc } from "$convex/_generated/dataModel";
import type { ResearchThread } from "$research-threads/types/research-thread";

/**
 * The stored row as the public shape, which is the one place a storage decision
 * is allowed to stop.
 *
 * `projectId` stops here: every thread a caller gets back is from the project
 * they asked about, so repeating it per row says nothing. Nothing about the
 * conversation is added either — turns are read by
 * `messages.list(("research", id))`, which needs nothing from this row.
 */
export const asThread = (row: Doc<"researchThreads">): ResearchThread => ({
  id: row._id,
  title: row.title,
  mode: row.mode,
  questionId: row.questionId,
  hypothesisId: row.hypothesisId,
  createdBy: row.createdBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});

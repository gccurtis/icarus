import type { Doc } from "$convex/_generated/dataModel";
import type { PersonaThread } from "$persona-threads/types/persona-thread";

/**
 * The stored row as the public shape, which is the one place a storage decision
 * is allowed to stop.
 *
 * `projectId` stops here; `branchedFrom` does not, because it is how a reader
 * reaches the conversation that came before the branch.
 */
export const asThread = (row: Doc<"personaThreads">): PersonaThread => ({
  id: row._id,
  personaId: row.personaId,
  title: row.title,
  branchedFrom: row.branchedFrom,
  createdBy: row.createdBy,
  updatedAt: row.updatedAt
});

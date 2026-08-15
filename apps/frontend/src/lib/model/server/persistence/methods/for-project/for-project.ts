import type { ProjectDatabase } from "$model/server/persistence/types";
import type { PersistenceState } from "$model/server/persistence/definition";
import { assertSafeProjectId } from "$model/server/persistence/methods/for-project/safe-project-id";

/**
 * Answers with one project's database, opening it on first use.
 *
 * **The in-flight promise is what is cached**, not the database. Two callers
 * arriving together against an unopened project must not each open PGlite over
 * the same directory; storing the promise makes the second await the first.
 *
 * A failed open is evicted, so a transient failure — a busy disk, a directory
 * that was not writable for a moment — does not poison that project for the
 * life of the process.
 */
export const forProject = (
  state: PersistenceState,
  projectId: string
): Promise<ProjectDatabase> => {
  assertSafeProjectId(projectId);

  const existing = state.open.get(projectId);
  if (existing) return existing;

  state.logger.debug("persistence.project.opening", { projectId });

  const opening = state.openProject(projectId).catch((error: unknown) => {
    state.open.delete(projectId);
    throw error;
  });

  state.open.set(projectId, opening);
  return opening;
};

import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import type { Logger } from "$model/server/observability/index.server";
import type { Database, Initializer, ProjectDatabase } from "$model/server/persistence/types";
import { prepareDirectory } from "$model/server/persistence/methods/for-project/open-project/prepare-directory";
import { initializeTables } from "$model/server/persistence/methods/for-project/open-project/initialize-tables";
import { closeProject } from "$model/server/persistence/methods/for-project/open-project/close-project";

/**
 * What opening a project needs and the registry does not hold: where projects
 * live, and which capabilities have tables in one.
 *
 * Bound once by the constructor, so the registry stays a cache over a function
 * of a project id.
 */
export interface OpenProjectContext {
  readonly root: string;
  readonly logger: Logger;
  readonly initializers: readonly Initializer[];
}

/**
 * Opens one project's database and brings its tables into existence.
 *
 * **Construction is atomic.** From the moment the instance exists it holds the
 * directory, so every failure below has to release it. Leaving it open would
 * lock the directory against the retry the registry's eviction is there to
 * allow — turning a transient failure into a permanent one.
 */
export const openProject = async (
  context: OpenProjectContext,
  projectId: string
): Promise<ProjectDatabase> => {
  const directory = await prepareDirectory(context.root, projectId);
  const pglite = await PGlite.create(directory);

  try {
    const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });

    await initializeTables(database, context.initializers);

    context.logger.info("persistence.project.opened", {
      projectId,
      directory,
      initializers: context.initializers.length
    });

    return {
      projectId,
      database,
      close: () => closeProject(context.logger, projectId, database, pglite)
    };
  } catch (error) {
    await pglite.close().catch(() => {});
    throw error;
  }
};

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import type { Configuration } from "$runtime/server/configuration/types";
import type { Logger } from "$runtime/server/observability/types";
import type { Database } from "$runtime/server/persistence/types";
import type { ProjectDatabase } from "$runtime/server/persistence/registry";
import { ProjectRegistry } from "$runtime/server/persistence/registry";
// The one place the runtime reaches into a capability, and it reaches only for
// the door. Which tables a project database holds is a composition decision, so
// it is made here rather than by each capability registering itself on import —
// which would make the set depend on what happened to be loaded.
import { initializeSettings } from "$settings/index.server";

export type { Database } from "$runtime/server/persistence/types";
export type { ProjectDatabase } from "$runtime/server/persistence/registry";

/**
 * Brings a capability's tables into existence in one project's database, then
 * verifies them. Every capability with a `persistence/` exports one.
 */
export type Initializer = (database: Kysely<Database>) => Promise<void>;

/**
 * Every capability's schema, in the order they are created.
 *
 * This is the composition root for storage: the one place that knows the full
 * set of tables a project database holds. A capability that is not listed here
 * has no tables, however many it declares — which is the failure this list is
 * shaped to make loud, since a missing entry shows up as the first query against
 * a table nobody created.
 *
 * Order matters only where one capability's tables reference another's. None do
 * yet, so this is registration order.
 */
const INITIALIZERS: readonly Initializer[] = [initializeSettings];

/** Where project databases live, resolved from the working directory. */
const projectsDirectory = (configuration: Configuration): string => {
  const configured = configuration.get("persistence.directory");
  const directory = typeof configured === "string" && configured.length > 0
    ? configured
    : join("data", "projects");
  return join(process.cwd(), directory);
};

/**
 * The process-wide database owner.
 *
 * One database *per project*, not one per process: a project is its own PGlite
 * directory, which is what makes project scoping structural. No query carries a
 * `project_id` predicate, and a capability that forgets to scope cannot leak
 * across projects because there is no cross-project reach to forget.
 */
export interface Persistence {
  /** Opens the project's database on first use, then returns the same one. */
  forProject(projectId: string): Promise<ProjectDatabase>;
  close(): Promise<void>;
}

export const createPersistence = (
  configuration: Configuration,
  logger: Logger
): Persistence => {
  const root = projectsDirectory(configuration);

  const openProject = async (projectId: string): Promise<ProjectDatabase> => {
    const directory = join(root, projectId);

    // PGlite creates its own directory but not the parents, so a fresh checkout
    // fails on the first open with an ENOENT naming a path that looks correct.
    await mkdir(directory, { recursive: true });

    const pglite = await PGlite.create(directory);

    // From here on the instance holds the directory, so every failure has to
    // release it. Leaving it open would lock the directory against the retry
    // the registry's eviction is there to allow — turning a transient failure
    // into a permanent one.
    try {
      const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });

      for (const initialize of INITIALIZERS) {
        await initialize(database);
      }

      logger.info("persistence.project.opened", {
        projectId,
        directory,
        initializers: INITIALIZERS.length
      });

      return { projectId, database, close: () => closeProject(projectId, database, pglite) };
    } catch (error) {
      await pglite.close().catch(() => {});
      throw error;
    }
  };

  const closeProject = async (
    projectId: string,
    database: Kysely<Database>,
    pglite: PGlite
  ): Promise<void> => {
    logger.debug("persistence.project.closing", { projectId });

    // Kysely's PGlite driver closes the instance itself — but only lazily, once
    // a query has initialized the driver. So `destroy()` is sufficient for a
    // database that was used and a no-op for one that was not, and the explicit
    // close covers the second case. Guarded because closing twice throws, which
    // would turn every clean shutdown into a non-zero exit.
    await database.destroy();
    if (!pglite.closed) await pglite.close();
  };

  const registry = new ProjectRegistry(openProject, logger);

  return {
    forProject: (projectId) => registry.get(projectId),
    close: () => registry.close()
  };
};

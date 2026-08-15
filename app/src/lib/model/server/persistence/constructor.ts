import { join } from "node:path";
import type { Configuration } from "$model/server/configuration/index.server";
import type { Logger } from "$model/server/observability/index.server";
import type { Initializer, Persistence } from "$model/server/persistence/types";
import { ProjectRegistry } from "$model/server/persistence/definition";
import { openProject } from "$model/server/persistence/methods/for-project/open-project/open-project";
// The one place the model reaches into a capability, and it reaches only for
// the door. Which tables a project database holds is a composition decision, so
// it is made here rather than by each capability registering itself on import —
// which would make the set depend on what happened to be loaded.
import { initializeNameManager } from "$name-manager/index.server";
import { initializeRichContent } from "$rich-content/index.server";
import { initializeSettings } from "$settings/index.server";

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
const INITIALIZERS: readonly Initializer[] = [
  initializeSettings,
  initializeNameManager,
  initializeRichContent
];

/** Where project databases live, resolved from the working directory. */
const projectsDirectory = (configuration: Configuration): string => {
  const configured = configuration.get("persistence.directory");
  const directory =
    typeof configured === "string" && configured.length > 0
      ? configured
      : join("data", "projects");
  return join(process.cwd(), directory);
};

/**
 * Returns a fresh registry over its own directory root.
 *
 * Nothing is opened here. A database is acquired on the first request for its
 * project, which is what keeps a process that never serves a project from
 * creating one — and what makes construction itself unable to fail halfway.
 */
export const createPersistence = (configuration: Configuration, logger: Logger): Persistence => {
  const context = {
    root: projectsDirectory(configuration),
    logger,
    initializers: INITIALIZERS
  };

  return new ProjectRegistry((projectId) => openProject(context, projectId), logger);
};

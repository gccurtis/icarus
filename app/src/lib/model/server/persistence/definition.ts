import type { Logger } from "$model/server/observability/index.server";
import type { Persistence, ProjectDatabase } from "$model/server/persistence/types";
import { close } from "$model/server/persistence/methods/close";
import { forProject } from "$model/server/persistence/methods/for-project/for-project";

/** Creates and initializes one project's database. Supplied by the constructor. */
export type OpenProject = (projectId: string) => Promise<ProjectDatabase>;

/**
 * What one instance holds.
 *
 * **The map is keyed by promise, not by value.** Two requests for the same
 * project arriving together must not each open PGlite against the same
 * directory — the second would race the first's schema initialization, and
 * PGlite is single-connection, so the loser fails in a way that looks like
 * corruption.
 */
export interface PersistenceState {
  readonly open: Map<string, Promise<ProjectDatabase>>;
  readonly openProject: OpenProject;
  readonly logger: Logger;
}

/**
 * Holds one open database per project, opening each on first use.
 *
 * `openProject` arrives as a dependency rather than being reached for, so the
 * caching, eviction, and shutdown rules below can be proven without a database
 * on disk — which is the only way to test them, since standing up an embedded
 * PostgreSQL costs roughly 750ms per instance.
 */
export class ProjectRegistry implements Persistence {
  readonly #state: PersistenceState;

  constructor(openProject: OpenProject, logger: Logger) {
    this.#state = { open: new Map(), openProject, logger };
  }

  forProject(projectId: string): Promise<ProjectDatabase> {
    return forProject(this.#state, projectId);
  }

  close(): Promise<void> {
    return close(this.#state);
  }
}

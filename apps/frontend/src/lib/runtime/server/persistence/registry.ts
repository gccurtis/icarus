import type { Kysely } from "kysely";
import type { Logger } from "$runtime/server/observability/types";
import type { Database } from "$runtime/server/persistence/types";

/**
 * One project's open database, and how to close it.
 */
export interface ProjectDatabase {
  readonly projectId: string;
  readonly database: Kysely<Database>;
  close(): Promise<void>;
}

/** Creates and initializes one project's database. Supplied by the door. */
export type OpenProject = (projectId: string) => Promise<ProjectDatabase>;

/**
 * A project id may become a directory name, so it has to be one safely.
 *
 * Rejecting rather than sanitizing: a silently rewritten id would open a
 * *different* project's database, which is the worst possible outcome for a
 * mistake this cheap to catch. `..` and separators are the attack; everything
 * else here is keeping ids legible across filesystems.
 *
 * **Lowercase only, deliberately.** Case-insensitive would admit `Foo` and
 * `foo` as distinct ids that the registry keys separately — while APFS and
 * NTFS fold them to one directory. Two projects would then share a database,
 * held by two single-connection instances at once. Latent on Linux, live on a
 * macOS dev machine, and it defeats the structural scoping the whole design
 * rests on.
 */
const SAFE_PROJECT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const assertSafeProjectId = (projectId: string): void => {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new Error(
      `Project id '${projectId}' is not usable as a directory name — expected 1-64 lowercase letters, digits, hyphens, or underscores, starting with a letter or digit`
    );
  }
};

/**
 * Holds one open database per project, opening each on first use.
 *
 * **Cached by promise, not by value.** Two requests for the same project
 * arriving together must not each open PGlite against the same directory — the
 * second would race the first's schema initialization, and PGlite is
 * single-connection, so the loser fails in a way that looks like corruption.
 * Storing the in-flight promise makes the second await the first.
 *
 * A failed open is evicted, so a transient failure does not poison the project
 * for the process's lifetime.
 */
export class ProjectRegistry {
  readonly #open = new Map<string, Promise<ProjectDatabase>>();

  constructor(
    private readonly openProject: OpenProject,
    private readonly logger: Logger
  ) {}

  get(projectId: string): Promise<ProjectDatabase> {
    assertSafeProjectId(projectId);

    const existing = this.#open.get(projectId);
    if (existing) return existing;

    this.logger.debug("persistence.project.opening", { projectId });

    const opening = this.openProject(projectId).catch((error: unknown) => {
      this.#open.delete(projectId);
      throw error;
    });

    this.#open.set(projectId, opening);
    return opening;
  }

  /**
   * Closes every open database.
   *
   * Settles rather than races: one project failing to close must not leave the
   * others open, and shutdown reports the failures rather than swallowing them.
   */
  async close(): Promise<void> {
    // `await pending` also surfaces a project that failed to *open*, so the
    // message below says "could not be closed" rather than blaming close.
    const closing = [...this.#open.values()].map(async (pending) => {
      const project = await pending;
      await project.close();
    });
    this.#open.clear();

    const results = await Promise.allSettled(closing);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `${failures.length} project database(s) could not be closed`
      );
    }
  }
}

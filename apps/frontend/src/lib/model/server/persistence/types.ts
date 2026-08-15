import type { Kysely } from "kysely";

/**
 * The tables every capability owns, merged into one interface.
 *
 * A capability declares its own tables onto this from its `persistence/tables.ts`
 * using `declare module`, which is the one place the bare-alias import rule does
 * not apply: declaration merging must name the module that declares the
 * interface, not a door that re-exports it.
 *
 * Deliberately empty here. Keeping the shape at the model boundary lets every
 * capability share one typed client without moving table ownership out of the
 * capability that owns them.
 *
 * **No table on this interface carries a `project_id` column.** A project is its
 * own database, so scoping is structural — see `persistence.md`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

/** One project's open database, and how to close it. */
export interface ProjectDatabase {
  readonly projectId: string;
  readonly database: Kysely<Database>;
  close(): Promise<void>;
}

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

/**
 * Brings a capability's tables into existence in one project's database, then
 * verifies them. Every capability with a `persistence/` exports one.
 */
export type Initializer = (database: Kysely<Database>) => Promise<void>;

/**
 * The door for Persistence.
 *
 * The composition root takes the constructor; a capability takes `Database`,
 * which is the interface its own tables merge onto. Nothing outside reaches the
 * registry, because a second one would open a project PGlite already holds.
 */
export { createPersistence } from "$model/server/persistence/constructor";
export type {
  Database,
  Initializer,
  Persistence,
  ProjectDatabase
} from "$model/server/persistence/types";

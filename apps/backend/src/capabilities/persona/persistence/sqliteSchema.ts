import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";
import { initializeResourceHistorySchema } from "#shared/persistence/resourceHistory.js";

export interface PersonaTableNames {
  personas: string;
  history: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createPersonaTableNames = (projectId: string): PersonaTableNames => ({
  personas: `psn_${projectPrefix(projectId)}_personas`,
  history: `psn_${projectPrefix(projectId)}_history`
});

export const initializePersonaSchema = (
  db: DatabaseConnection,
  tables: PersonaTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  // Sections are columns rather than one definition blob: the schema is fixed and
  // known, so "which personas mention retrieval" stays a plain query instead of
  // JSON extraction. The context reference is a single nullable JSON object
  // because it is a two-field value, not a list.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.personas} (
      id                       TEXT    PRIMARY KEY,
      display_name             TEXT    NOT NULL,
      description              TEXT    NOT NULL DEFAULT '',
      focus                    TEXT    NOT NULL DEFAULT '',
      background               TEXT    NOT NULL DEFAULT '',
      approach                 TEXT    NOT NULL DEFAULT '',
      output_preferences       TEXT    NOT NULL DEFAULT '',
      verification             TEXT    NOT NULL DEFAULT '',
      context_json             TEXT,
      context_wrapper_id       TEXT,
      context_wrapper_revision INTEGER,
      definition_digest        TEXT    NOT NULL,
      revision                 INTEGER NOT NULL DEFAULT 1,
      created_at               TEXT    NOT NULL,
      updated_at               TEXT    NOT NULL,
      CHECK ((context_json IS NULL AND context_wrapper_id IS NULL)
          OR (context_json IS NOT NULL AND context_wrapper_id IS NOT NULL))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.personas}_name_nocase
      ON ${tables.personas}(display_name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS ${tables.personas}_display_name
      ON ${tables.personas}(display_name);
  `);
  initializeResourceHistorySchema(db, tables.history);
};

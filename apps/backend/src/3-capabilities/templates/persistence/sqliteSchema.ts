import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";

export interface TemplateTableNames {
  templates: string;
  commandClaims: string;
  activityOutbox: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createTemplateTableNames = (projectId: string): TemplateTableNames => {
  const root = `tpl_${projectPrefix(projectId)}`;
  return {
    templates: `${root}_templates`,
    commandClaims: `${root}_command_claims`,
    activityOutbox: `${root}_activity_outbox`
  };
};

export const initializeTemplateSchema = (
  db: DatabaseConnection,
  tables: TemplateTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.templates} (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      description TEXT,
      state TEXT NOT NULL CHECK (state IN ('reserving', 'ready')),
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      UNIQUE (kind, resource_id),
      CHECK (resource_id = id)
    );

    CREATE INDEX IF NOT EXISTS ${tables.templates}_live
      ON ${tables.templates}(kind, created_at, id)
      WHERE deleted_at IS NULL AND state = 'ready';

    CREATE TABLE IF NOT EXISTS ${tables.commandClaims} (
      request_id TEXT PRIMARY KEY,
      request_digest TEXT NOT NULL,
      command_type TEXT NOT NULL,
      -- Allocated by Templates and frozen here before the adapter call, so a
      -- resumed pending claim reuses the same identity instead of minting one.
      template_id TEXT,
      state TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
      result_json BLOB,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- No foreign key to the templates table. The payload is self-contained so a
    -- later catalog change cannot strand a fact Activity has not yet consumed.
    CREATE TABLE IF NOT EXISTS ${tables.activityOutbox} (
      fact_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('template.registered', 'template.deleted')),
      template_id TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      actor_id TEXT,
      occurred_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS ${tables.activityOutbox}_unpublished
      ON ${tables.activityOutbox}(occurred_at, fact_id)
      WHERE published_at IS NULL;
  `);
};

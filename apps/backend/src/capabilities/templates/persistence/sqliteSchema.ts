import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";
import { initializeResourceHistorySchema } from "#shared/persistence/resourceHistory.js";

export interface TemplateTableNames {
  templates: string;
  commandClaims: string;
  transactionOutbox: string;
  history: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createTemplateTableNames = (projectId: string): TemplateTableNames => {
  const root = `tpl_${projectPrefix(projectId)}`;
  return {
    templates: `${root}_templates`,
    commandClaims: `${root}_command_claims`,
    transactionOutbox: `${root}_transaction_outbox`,
    history: `${root}_history`
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
      name TEXT NOT NULL,
      description TEXT,
      -- The declared parameters. NOT NULL because an omitted wire field and {}
      -- mean the same thing, so nothing downstream branches on null.
      context_bindings_json BLOB NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('reserving', 'ready')),
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (kind, resource_id),
      CHECK (resource_id = id)
    );

    CREATE INDEX IF NOT EXISTS ${tables.templates}_ready
      ON ${tables.templates}(kind, created_at, id)
      WHERE state = 'ready';

    -- Per kind, so a Document and a Spreadsheet template may share a name.
    --
    -- No partial predicate, for two reasons. Deletion removes the live row
    -- rather than flagging it, so a name is freed by construction. And covering
    -- 'reserving' rows is what makes a collision surface in reserve(), before
    -- the adapter call, rather than at markReady() after a backing copy exists.
    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.templates}_name_nocase
      ON ${tables.templates}(kind, name COLLATE NOCASE);

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

    -- No foreign key to current templates: accepted source transactions remain
    -- publishable after logical deletion.
    CREATE TABLE IF NOT EXISTS ${tables.transactionOutbox} (
      source_transaction_id TEXT PRIMARY KEY,
      transaction_kind TEXT NOT NULL
        CHECK (transaction_kind IN
          ('template.registered', 'template.updated', 'template.deleted')),
      template_id TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      actor_id TEXT,
      origin TEXT NOT NULL
        CHECK (origin IN ('user', 'agent', 'automation', 'system')),
      occurred_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS ${tables.transactionOutbox}_unpublished
      ON ${tables.transactionOutbox}(occurred_at, source_transaction_id)
      WHERE published_at IS NULL;
  `);
  initializeResourceHistorySchema(db, tables.history);
};

import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";
import { initializeResourceHistorySchema } from "#utils/persistence/resourceHistory.js";

export interface TemplateTableNames {
  templates: string;
  commandReceipts: string;
  transactionOutbox: string;
  history: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createTemplateTableNames = (projectId: string): TemplateTableNames => {
  const root = `tpl_${projectPrefix(projectId)}`;
  return {
    templates: `${root}_templates`,
    commandReceipts: `${root}_command_receipts`,
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
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      -- One template per backing resource. No CHECK tying resource_id to id:
      -- the capability that stores a resource allocates its ID, so Templates
      -- names the catalog row and the owning capability names the resource.
      UNIQUE (kind, resource_id)
    );

    -- Every row is a live, usable template; there is no state to filter on.
    CREATE INDEX IF NOT EXISTS ${tables.templates}_catalog
      ON ${tables.templates}(kind, created_at, id);

    -- Per kind, so a Document and a Spreadsheet template may share a name.
    -- No partial predicate: deletion removes the live row rather than flagging
    -- it, so a name is freed by construction rather than by a predicate.
    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.templates}_name_nocase
      ON ${tables.templates}(kind, name COLLATE NOCASE);

    -- Idempotency without reservation: a completed command records what it
    -- returned, and an exact retry replays it. Nothing is claimed ahead of the
    -- work, so there is no pending state and no identity to freeze.
    CREATE TABLE IF NOT EXISTS ${tables.commandReceipts} (
      request_id TEXT PRIMARY KEY,
      request_digest TEXT NOT NULL,
      command_type TEXT NOT NULL,
      result_json BLOB NOT NULL,
      created_at TEXT NOT NULL
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

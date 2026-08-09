import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";

export interface ActivityTableNames {
  meta: string;
  transactions: string;
  presence: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createActivityTableNames = (projectId: string): ActivityTableNames => {
  const root = `activity_${projectPrefix(projectId)}`;
  return {
    meta: `${root}_meta`,
    transactions: `${root}_transactions`,
    presence: `${root}_presence`
  };
};

export const initializeActivitySchema = (
  db: DatabaseConnection,
  tables: ActivityTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.meta} (
      singleton_key TEXT PRIMARY KEY CHECK (singleton_key = 'activity'),
      next_sequence INTEGER NOT NULL CHECK (next_sequence >= 1)
    );

    INSERT INTO ${tables.meta} (singleton_key, next_sequence)
      VALUES ('activity', 1)
      ON CONFLICT(singleton_key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS ${tables.transactions} (
      id TEXT PRIMARY KEY,
      sequence INTEGER NOT NULL UNIQUE CHECK (sequence >= 1),
      kind TEXT NOT NULL,
      resource_id TEXT,
      operation TEXT NOT NULL,
      revision INTEGER CHECK (revision IS NULL OR revision >= 0),
      change_set_id TEXT,
      actor_id TEXT,
      origin TEXT NOT NULL
        CHECK (origin IN ('user', 'agent', 'automation', 'system')),
      occurred_at TEXT NOT NULL,
      metadata_json BLOB NOT NULL,
      transaction_digest TEXT NOT NULL,
      published_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.transactions}_feed
      ON ${tables.transactions}(sequence DESC, id);
    CREATE INDEX IF NOT EXISTS ${tables.transactions}_kind_resource
      ON ${tables.transactions}(kind, resource_id, sequence DESC, id);

    CREATE TABLE IF NOT EXISTS ${tables.presence} (
      session_id TEXT PRIMARY KEY,
      actor_id TEXT,
      kind TEXT,
      resource_id TEXT,
      state_json BLOB NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.presence}_expiry
      ON ${tables.presence}(expires_at, session_id);
    CREATE INDEX IF NOT EXISTS ${tables.presence}_kind_resource
      ON ${tables.presence}(kind, resource_id, expires_at, session_id);
  `);
};

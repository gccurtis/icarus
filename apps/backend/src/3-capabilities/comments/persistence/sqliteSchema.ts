import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";

export interface CommentTableNames {
  comments: string;
  receipts: string;
  activityOutbox: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createCommentTableNames = (projectId: string): CommentTableNames => {
  const root = `cmt_${projectPrefix(projectId)}`;
  return {
    comments: `${root}_comments`,
    receipts: `${root}_command_receipts`,
    activityOutbox: `${root}_activity_outbox`
  };
};

export const initializeCommentSchema = (
  db: DatabaseConnection,
  tables: CommentTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.comments} (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      mentions_json BLOB NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      sub_target_json BLOB,
      state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS ${tables.comments}_target
      ON ${tables.comments}(resource_kind, resource_id, created_at, id)
      WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS ${tables.comments}_target_state
      ON ${tables.comments}(resource_kind, resource_id, state, created_at, id)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS ${tables.receipts} (
      request_id TEXT PRIMARY KEY,
      request_digest TEXT NOT NULL,
      result_json BLOB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${tables.activityOutbox} (
      transaction_id TEXT PRIMARY KEY,
      source_request_id TEXT NOT NULL UNIQUE,
      operation TEXT NOT NULL
        CHECK (operation IN ('created', 'updated', 'resolved', 'reopened', 'deleted')),
      comment_id TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
      mention_count INTEGER NOT NULL CHECK (mention_count >= 0),
      actor_id TEXT NOT NULL,
      origin TEXT NOT NULL
        CHECK (origin IN ('user', 'agent', 'automation', 'system')),
      occurred_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE INDEX IF NOT EXISTS ${tables.activityOutbox}_unpublished
      ON ${tables.activityOutbox}(occurred_at, transaction_id)
      WHERE published_at IS NULL;
  `);
};

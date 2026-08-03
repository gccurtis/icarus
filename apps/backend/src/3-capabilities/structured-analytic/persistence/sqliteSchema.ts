import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";
import { initializeResourceHistorySchema } from "#utils/persistence/resourceHistory.js";

export interface StructuredAnalyticTableNames {
  analytics: string;
  history: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createStructuredAnalyticTableNames = (
  projectId: string
): StructuredAnalyticTableNames => {
  const root = `sta_${projectPrefix(projectId)}`;
  return {
    analytics: `${root}_analytics`,
    history: `${root}_history`
  };
};

export const initializeStructuredAnalyticSchema = (
  db: DatabaseConnection,
  tables: StructuredAnalyticTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.analytics} (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      -- The whole recipe as one document. Not decomposed into join, placement,
      -- and filter tables: nothing queries inside a definition, it is always
      -- read and written whole, and normalizing it would buy a schema migration
      -- for every pill the design adds.
      --
      -- TEXT, not BLOB. Templates and Slides store JSON as BLOB with a Buffer
      -- encoder, but the shared history table is unavoidably TEXT written by
      -- JSON.stringify, and one capability writing the same document two ways
      -- into two tables is worse than matching either convention.
      definition_json TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- list() orders by (updated_at DESC, id ASC). Every row is live — deletion
    -- removes the row rather than flagging it — so there is no state predicate.
    CREATE INDEX IF NOT EXISTS ${tables.analytics}_catalog
      ON ${tables.analytics}(updated_at DESC, id ASC);
  `);

  // There is deliberately no unique index on title. Two analytics may share a
  // title: the name that must be unique is the Structured Data entry a `save`
  // writes to, and Structured Data owns that constraint.
  initializeResourceHistorySchema(db, tables.history);
};

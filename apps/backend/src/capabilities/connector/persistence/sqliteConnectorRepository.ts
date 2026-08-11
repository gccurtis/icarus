// SQLite implementation of ConnectorStore.
// Table prefix = SHA-256(projectId).slice(0,16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import {
  getResourceHistory,
  initializeResourceHistorySchema,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  nextRevisionAfterHistory,
  pruneHistoryBefore,
  purgeResourceHistory,
  type ResourceHistoryRecord
} from "#shared/persistence/resourceHistory.js";
import type {
  ConnectorEntry,
  ConnectorHistorySnapshot,
  ConnectorIngestionState,
  ConnectorItemEntry,
  ConnectorSyncConfig,
} from "../domain/model.js";
import type { ConnectorStore } from "../ports/repository.js";

const tablePrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

function createSchema(db: DB, p: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conn_${p}_entries (
      id                  TEXT PRIMARY KEY
        CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),
      kind                TEXT NOT NULL
        CHECK (kind IN ('connector::file::text', 'connector::file::other', 'connector::directory::text', 'connector::directory::other')),
      provider_kind       TEXT NOT NULL
        CHECK (length(provider_kind) > 0),
      locator             TEXT NOT NULL
        CHECK (length(locator) > 0),
      label               TEXT NOT NULL
        CHECK (length(trim(label)) > 0),
      revision            INTEGER NOT NULL
        CHECK (revision >= 1),
      sync_config_json    TEXT
        CHECK (sync_config_json IS NULL OR (
          json_valid(sync_config_json) AND json_type(sync_config_json) = 'object'
        )),
      syncing             INTEGER NOT NULL DEFAULT 0
        CHECK (syncing IN (0, 1)),
      ingestion_state     TEXT NOT NULL DEFAULT 'active'
        CHECK (ingestion_state IN ('active', 'pending', 'failed')),
      knowledge_source_ids_json TEXT NOT NULL
        CHECK (json_valid(knowledge_source_ids_json) AND json_type(knowledge_source_ids_json) = 'array'),
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS conn_${p}_entries_active_locator
      ON conn_${p}_entries(provider_kind, locator);

    CREATE INDEX IF NOT EXISTS conn_${p}_entries_syncing
      ON conn_${p}_entries(syncing);

    CREATE INDEX IF NOT EXISTS conn_${p}_entries_kind_created
      ON conn_${p}_entries(kind, created_at DESC);

    CREATE TABLE IF NOT EXISTS conn_${p}_items (
      entry_id            TEXT NOT NULL,
      item_key            TEXT NOT NULL,
      name                TEXT NOT NULL
        CHECK (length(trim(name)) > 0),
      extension           TEXT NOT NULL,
      byte_size           INTEGER NOT NULL
        CHECK (byte_size >= 0),
      status              TEXT NOT NULL
        CHECK (status IN ('prose', 'other')),
      revision_token      TEXT NOT NULL
        CHECK (length(revision_token) > 0),
      last_modified_at    TEXT NOT NULL
        CHECK (length(last_modified_at) > 0),
      knowledge_source_id TEXT,
      PRIMARY KEY (entry_id, item_key),
      FOREIGN KEY (entry_id)
        REFERENCES conn_${p}_entries(id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS conn_${p}_items_status
      ON conn_${p}_items(entry_id, status);
  `);
  initializeResourceHistorySchema(db, `conn_${p}_history`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: Record<string, any>): ConnectorEntry {
  return {
    id: row.id as string,
    kind: row.kind as ConnectorEntry["kind"],
    providerKind: row.provider_kind as string,
    locator: row.locator as string,
    label: row.label as string,
    revision: row.revision as number,
    syncConfig: row.sync_config_json
      ? (JSON.parse(row.sync_config_json as string) as ConnectorSyncConfig)
      : null,
    syncing: (row.syncing as number) === 1,
    ingestionState: row.ingestion_state as ConnectorIngestionState,
    knowledgeSourceIds: JSON.parse(row.knowledge_source_ids_json as string) as readonly string[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: Record<string, any>): ConnectorItemEntry {
  return {
    itemKey: row.item_key as string,
    name: row.name as string,
    extension: row.extension as string,
    byteSize: row.byte_size as number,
    revisionToken: row.revision_token as string,
    lastModifiedAt: row.last_modified_at as string,
    status: row.status as "prose" | "other",
    knowledgeSourceId: (row.knowledge_source_id as string | null) ?? null,
  };
}

export class SQLiteConnectorStore implements ConnectorStore {
  private readonly db: DB;
  private readonly p: string;
  private readonly historyTableName: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.p = tablePrefix(projectId);
    this.historyTableName = `conn_${this.p}_history`;
    createSchema(this.db, this.p);
    this.db.pragma("foreign_keys = ON");
  }

  getById(id: string): ConnectorEntry | undefined {
    const row = this.db
      .prepare(`SELECT * FROM conn_${this.p}_entries WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  getByProviderAndLocator(providerKind: string, locator: string): ConnectorEntry | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM conn_${this.p}_entries
         WHERE provider_kind = ? AND locator = ?`
      )
      .get(providerKind, locator) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  listAll(): ConnectorEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM conn_${this.p}_entries ORDER BY created_at DESC`)
      .all() as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  insert(entry: ConnectorEntry, items: ConnectorItemEntry[]): void {
    const insertEntry = this.db.prepare(`
      INSERT INTO conn_${this.p}_entries
        (id, kind, provider_kind, locator, label, revision,
         sync_config_json, syncing, ingestion_state, knowledge_source_ids_json,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO conn_${this.p}_items
        (entry_id, item_key, name, extension, byte_size, status,
         revision_token, last_modified_at, knowledge_source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      insertEntry.run(
        entry.id, entry.kind, entry.providerKind, entry.locator, entry.label,
        entry.revision,
        entry.syncConfig ? JSON.stringify(entry.syncConfig) : null,
        entry.syncing ? 1 : 0,
        entry.ingestionState,
        JSON.stringify(entry.knowledgeSourceIds),
        entry.createdAt, entry.updatedAt,
      );

      for (const item of items) {
        insertItem.run(
          entry.id, item.itemKey, item.name, item.extension, item.byteSize,
          item.status, item.revisionToken, item.lastModifiedAt,
          item.knowledgeSourceId,
        );
      }
    });

    tx();
  }

  nextRevision(id: string): number {
    return nextRevisionAfterHistory(this.db, this.historyTableName, "connector", id);
  }

  update(
    entry: ConnectorEntry,
    items: ConnectorItemEntry[],
    previous: ConnectorHistorySnapshot,
  ): void {
    const updateEntry = this.db.prepare(`
      UPDATE conn_${this.p}_entries
      SET kind = ?, provider_kind = ?, locator = ?, label = ?, revision = ?,
          sync_config_json = ?, syncing = ?, ingestion_state = ?, knowledge_source_ids_json = ?,
          updated_at = ?
      WHERE id = ? AND revision = ? AND syncing = 1
    `);

    const deleteItems = this.db.prepare(
      `DELETE FROM conn_${this.p}_items WHERE entry_id = ?`
    );

    const insertItem = this.db.prepare(`
      INSERT INTO conn_${this.p}_items
        (entry_id, item_key, name, extension, byte_size, status,
         revision_token, last_modified_at, knowledge_source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      const result = updateEntry.run(
        entry.kind, entry.providerKind, entry.locator, entry.label,
        entry.revision,
        entry.syncConfig ? JSON.stringify(entry.syncConfig) : null,
        entry.syncing ? 1 : 0,
        entry.ingestionState,
        JSON.stringify(entry.knowledgeSourceIds),
        entry.updatedAt,
        entry.id,
        previous.entry.revision,
      );
      if (result.changes !== 1) {
        throw new Error(`Connector entry lost its current sync state: ${entry.id}`);
      }
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "connector",
        resourceId: previous.entry.id,
        revision: previous.entry.revision,
        snapshot: previous,
        recordedAt: entry.updatedAt
      });

      deleteItems.run(entry.id);

      for (const item of items) {
        insertItem.run(
          entry.id, item.itemKey, item.name, item.extension, item.byteSize,
          item.status, item.revisionToken, item.lastModifiedAt,
          item.knowledgeSourceId,
        );
      }
    });

    tx();
  }

  markIngestionState(
    id: string,
    state: Exclude<ConnectorIngestionState, "active">,
    trackedKnowledgeSourceIds: readonly string[],
    updatedAt: string,
  ): void {
    const result = this.db.prepare(`
      UPDATE conn_${this.p}_entries
      SET ingestion_state = ?, knowledge_source_ids_json = ?, updated_at = ?
      WHERE id = ? AND syncing = 1
    `).run(state, JSON.stringify(trackedKnowledgeSourceIds), updatedAt, id);
    if (result.changes !== 1) {
      throw new Error(`Connector ingestion state lost its active sync claim: ${id}`);
    }
  }

  delete(snapshot: ConnectorHistorySnapshot, deletedAt: string): number {
    return this.db.transaction(() => {
      const current = this.db.prepare(`
        SELECT revision FROM conn_${this.p}_entries
        WHERE id = ? AND revision = ? AND syncing = 1
      `).get(snapshot.entry.id, snapshot.entry.revision) as { revision: number } | undefined;
      if (!current) throw new Error(`Connector delete lost its current claim: ${snapshot.entry.id}`);
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "connector",
        resourceId: snapshot.entry.id,
        revision: snapshot.entry.revision,
        snapshot,
        recordedAt: deletedAt
      });
      const deletedRevision = snapshot.entry.revision + 1;
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "connector",
        resourceId: snapshot.entry.id,
        revision: deletedRevision,
        recordedAt: deletedAt
      });
      this.db.prepare(`DELETE FROM conn_${this.p}_entries WHERE id = ?`)
        .run(snapshot.entry.id);
      return deletedRevision;
    })();
  }

  getItems(entryId: string): ConnectorItemEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM conn_${this.p}_items WHERE entry_id = ?`)
      .all(entryId) as Record<string, unknown>[];
    return rows.map(rowToItem);
  }

  setSyncing(id: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE conn_${this.p}_entries SET syncing = 1
         WHERE id = ? AND syncing = 0`
      )
      .run(id);
    return result.changes > 0;
  }

  clearSyncing(id: string): void {
    this.db
      .prepare(`UPDATE conn_${this.p}_entries SET syncing = 0 WHERE id = ?`)
      .run(id);
  }

  resetSyncing(): number {
    const result = this.db
      .prepare(`UPDATE conn_${this.p}_entries SET syncing = 0 WHERE syncing = 1`)
      .run();
    return result.changes;
  }

  listSyncableEntries(): ConnectorEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM conn_${this.p}_entries
         WHERE syncing = 0
           AND sync_config_json IS NOT NULL
         ORDER BY created_at DESC`
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  updateSyncTimestamp(id: string, lastSyncedAt: string): void {
    this.db
      .prepare(
        `UPDATE conn_${this.p}_entries
         SET sync_config_json = json_set(
           COALESCE(sync_config_json, '{}'),
           '$.lastSyncedAt', ?
         ), updated_at = ?
         WHERE id = ?`
      )
      .run(lastSyncedAt, new Date().toISOString(), id);
  }

  purge(id: string): "purged" | "current" | "missing" {
    if (this.getById(id)) return "current";
    return purgeResourceHistory(this.db, this.historyTableName, "connector", id)
      ? "purged"
      : "missing";
  }

  history(id: string): ResourceHistoryRecord<ConnectorHistorySnapshot>[] {
    return getResourceHistory<ConnectorHistorySnapshot>(
      this.db,
      this.historyTableName,
      "connector",
      id
    );
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.historyTableName,
      cutoff,
      (_kind, id) => Boolean(this.getById(id))
    );
  }

  purgeExpired(cutoff: string): number {
    let purged = 0;
    for (const resource of listExpiredDeletedResources(this.db, this.historyTableName, cutoff)) {
      if (!this.getById(resource.resourceId) && this.purge(resource.resourceId) === "purged") {
        purged += 1;
      }
    }
    return purged;
  }
}

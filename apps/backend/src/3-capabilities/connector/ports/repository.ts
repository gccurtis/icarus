import type { ConnectorEntry, ConnectorSyncConfig } from "../domain/model.js";
import type { ConnectorItemEntry } from "../domain/model.js";

/**
 * ConnectorStore — persistence interface for Connector capability.
 * All methods are synchronous (SQLite via better-sqlite3).
 */
export interface ConnectorStore {
  getById(id: string): ConnectorEntry | undefined;
  getByProviderAndLocator(providerKind: string, locator: string): ConnectorEntry | undefined;
  listAll(): ConnectorEntry[];

  /** Insert a new connector entry and its items. */
  insert(entry: ConnectorEntry, items: ConnectorItemEntry[]): void;
  /** Update entry metadata and replace all items atomically. */
  update(entry: ConnectorEntry, items: ConnectorItemEntry[]): void;
  softDelete(id: string, deletedAt: string): void;

  /** Get items for a connector. */
  getItems(entryId: string): ConnectorItemEntry[];

  /**
   * Atomically set syncing = true if currently false.
   * Returns true if the state changed, false if it was already syncing.
   */
  setSyncing(id: string): boolean;
  /** Set syncing = false. Called on Job completion or failure. */
  clearSyncing(id: string): void;

  /** List entries with syncType = "scheduled" and syncing = false. */
  listSyncableEntries(): ConnectorEntry[];

  /** Update sync config lastSyncedAt. */
  updateSyncTimestamp(id: string, lastSyncedAt: string): void;
}
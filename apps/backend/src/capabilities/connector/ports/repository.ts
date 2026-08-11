import type {
  ConnectorEntry,
  ConnectorIngestionState,
  ConnectorSyncConfig,
  ConnectorHistorySnapshot,
} from "../domain/model.js";
import type { ConnectorItemEntry } from "../domain/model.js";
import type { ResourceHistoryRecord } from "#shared/persistence/resourceHistory.js";

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
  /** Next revision for a deterministic identity with no current row. */
  nextRevision(id: string): number;
  /** Update entry metadata and replace all items atomically. */
  update(
    entry: ConnectorEntry,
    items: ConnectorItemEntry[],
    previous: ConnectorHistorySnapshot
  ): void;
  /**
   * Persist a reconciliation boundary without replacing the last active item
   * snapshot. Tracked source IDs are the union that a retry must reconcile.
   */
  markIngestionState(
    id: string,
    state: Exclude<ConnectorIngestionState, "active">,
    trackedKnowledgeSourceIds: readonly string[],
    updatedAt: string,
  ): void;
  delete(snapshot: ConnectorHistorySnapshot, deletedAt: string): number;
  purge(id: string): "purged" | "current" | "missing";
  history(id: string): ResourceHistoryRecord<ConnectorHistorySnapshot>[];
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;

  /** Get items for a connector. */
  getItems(entryId: string): ConnectorItemEntry[];

  /**
   * Atomically set syncing = true if currently false.
   * Returns true if the state changed, false if it was already syncing.
   */
  setSyncing(id: string): boolean;
  /** Set syncing = false. Called on Job completion or failure. */
  clearSyncing(id: string): void;
  /** Recover in-process sync locks left set by a previous process crash. */
  resetSyncing(): number;

  /** List entries with syncType = "scheduled" and syncing = false. */
  listSyncableEntries(): ConnectorEntry[];

  /** Update sync config lastSyncedAt. */
  updateSyncTimestamp(id: string, lastSyncedAt: string): void;
}

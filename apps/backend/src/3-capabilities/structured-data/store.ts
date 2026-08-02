// DataStore interface — synchronous (SQLite is synchronous).
// Persistence scope (user vs project) is encoded in the store instance via table prefix.

import type { DataEntry, DataKind } from "./types.js";
import type { ResourceHistoryRecord } from "#utils/persistence/resourceHistory.js";

export interface DataStore {
  getEntry(id: string): DataEntry | undefined;
  getByDisplayName(displayName: string): DataEntry | undefined;
  listAll(kind?: DataKind): DataEntry[];
  insert(entry: DataEntry): void;
  update(entry: DataEntry, expectedRevision: number): boolean;
  delete(id: string, expectedRevision: number, deletedAt: string): number | undefined;
  purge(id: string): "purged" | "current" | "missing";
  history(id: string): ResourceHistoryRecord<DataEntry>[];
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}

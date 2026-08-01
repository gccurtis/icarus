// DataStore interface — synchronous (SQLite is synchronous).
// Persistence scope (user vs project) is encoded in the store instance via table prefix.

import type { DataEntry, DataKind } from "./types.js";

export interface DataStore {
  getEntry(id: string): DataEntry | undefined;
  getByDisplayName(displayName: string): DataEntry | undefined;
  listAll(kind?: DataKind): DataEntry[];
  insert(entry: DataEntry): void;
  update(entry: DataEntry, expectedRevision: number): boolean;
  softDelete(id: string, expectedRevision: number, deletedAt: string): boolean;
}

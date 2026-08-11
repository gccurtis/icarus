// ContextStore interface.
// All methods are synchronous (SQLite is synchronous).
// projectId is encoded in the store instance — not in method signatures.

import type { ContextRecord } from "./types.js";
import type { ResourceHistoryRecord } from "#shared/persistence/resourceHistory.js";

export interface ContextStore {
  get(id: string): ContextRecord | undefined;
  getByName(displayName: string): ContextRecord | undefined;
  /** includePrivate: when false, excludes records with private = true. */
  list(includePrivate: boolean): ContextRecord[];
  insert(record: ContextRecord): void;
  update(record: ContextRecord, expectedRevision: number): boolean;
  delete(id: string, deletedAt: string): number | undefined;
  purge(id: string): "purged" | "current" | "missing";
  history(id: string): ResourceHistoryRecord<ContextRecord>[];
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}

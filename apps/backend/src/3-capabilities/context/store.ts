// ContextStore interface.
// All methods are synchronous (SQLite is synchronous).
// projectId is encoded in the store instance — not in method signatures.

import type { ContextRecord } from "./types.js";

export interface ContextStore {
  get(id: string): ContextRecord | undefined;
  getByName(displayName: string): ContextRecord | undefined;
  /** includePrivate: when false, excludes records with private = true. */
  list(includePrivate: boolean): ContextRecord[];
  insert(record: ContextRecord): void;
  update(record: ContextRecord): void;
  softDelete(id: string, deletedAt: string): void;
}

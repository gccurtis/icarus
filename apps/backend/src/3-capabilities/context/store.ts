// ContextStore interface.
// All methods are synchronous (SQLite is synchronous).
// userId/projectId are encoded in the store instance — not in method signatures.

import type { ContextRecord, ContextStoreScope } from "./types.js";

export interface ContextStore {
  get(id: string, scope: ContextStoreScope): ContextRecord | undefined;
  getByName(displayName: string, scope: ContextStoreScope): ContextRecord | undefined;
  /** includeAnonymous: when false, excludes records whose displayName starts with '~'. */
  list(scope: ContextStoreScope, includeAnonymous: boolean): ContextRecord[];
  insert(record: ContextRecord, scope: ContextStoreScope): void;
  update(record: ContextRecord, scope: ContextStoreScope): void;
  softDelete(id: string, scope: ContextStoreScope, deletedAt: string): void;
}

// NameManagerStore interface.
// All methods are synchronous (SQLite is synchronous).
// projectId is encoded in the store instance (via table prefix) — not in method signatures.

import type { NameEntry, NameKind } from "./types.js";

export interface NameManagerStore {
  getEntry(id: string): NameEntry | undefined;
  getByDisplayName(scopeId: string, displayName: string): NameEntry[];
  listScope(scopeId: string, kind?: NameKind): NameEntry[];
  insert(entry: NameEntry): void;
  update(entry: NameEntry): void;
  softDelete(id: string, deletedAt: string): void;
}

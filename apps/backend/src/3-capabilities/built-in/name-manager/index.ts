export { createNameManager } from "./name-manager.js";
export type { NameManager, NameManagerConfig } from "./name-manager.js";
export type {
  NameEntry, NameKind, NameManagerSnapshot, NameResolution,
  SnapshotRequest, ResolveRequest, ListRequest,
  DeclareNameRequest, RenameRequest, UpdateBodyRequest
} from "./types.js";
export { StaleRevisionError, NameConflictError, NameNotFoundError } from "./types.js";
export type { NameManagerStore } from "./store.js";
export { SQLiteNameManagerStore } from "./sqlite-store.js";

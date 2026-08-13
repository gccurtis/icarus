import type { GeneralFile, GeneralFileFilter } from "../domain/model.js";
import type { ResourceHistoryRecord } from "#shared/persistence/resourceHistory.js";

/**
 * GeneralFileStore — persistence interface for General Files.
 * All methods are synchronous (SQLite via better-sqlite3).
 * Project isolation is encoded in the store instance.
 */
export interface GeneralFileStore {
  /** Get by content-addressed ID. */
  getById(id: string): GeneralFile | undefined;

  /** Get current file by content hash (for idempotent upload check). */
  getByHash(contentHash: string): GeneralFile | undefined;

  /** List active files, optionally filtered. Returns metadata only (no content). */
  list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[];

  /** Insert a new file record. */
  insert(file: GeneralFile): void;

  /** Next revision for a deterministic identity that has no current row. */
  nextRevision(id: string): number;

  /**
   * Atomically insert a replacement and move the previous identity to history.
   */
  replace(previous: GeneralFile, replacement: GeneralFile, replacedAt: string): void;

  /** Atomically retire a file in favour of an already-active target. */
  linkReplacement(previous: GeneralFile, replacementId: string, replacedAt: string): void;

  /** Move a current file to history and append its deletion revision. */
  delete(id: string, deletedAt: string): number | undefined;

  purge(id: string): "purged" | "current" | "missing";
  history(id: string): ResourceHistoryRecord<GeneralFile>[];
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}

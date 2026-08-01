import type { GeneralFile, GeneralFileFilter } from "../domain/model.js";

/**
 * GeneralFileStore — persistence interface for General Files.
 * All methods are synchronous (SQLite via better-sqlite3).
 * Project isolation is encoded in the store instance.
 */
export interface GeneralFileStore {
  /** Get by content-addressed ID. */
  getById(id: string): GeneralFile | undefined;

  /** Get active file by content hash (for idempotent upload check). */
  getByHash(contentHash: string): GeneralFile | undefined;

  /** List active files, optionally filtered. Returns metadata only (no content). */
  list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[];

  /** Insert a new file record. */
  insert(file: GeneralFile): void;

  /** Update an existing file record. */
  update(file: GeneralFile): void;

  /**
   * Atomically activate a replacement and retire the previous version.
   * The replacement may be a previously soft-deleted content-addressed row.
   */
  replace(previous: GeneralFile, replacement: GeneralFile, replacedAt: string): void;

  /** Atomically retire a file in favour of an already-active target. */
  linkReplacement(previous: GeneralFile, replacementId: string, replacedAt: string): void;

  /** Soft-delete a file. */
  softDelete(id: string, deletedAt: string): void;
}

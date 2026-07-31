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

  /** Soft-delete a file. */
  softDelete(id: string, deletedAt: string): void;
}
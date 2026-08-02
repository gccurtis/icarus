// SQLite implementation of GeneralFileStore.
// Table prefix = SHA-256(projectId).slice(0,16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import {
  getResourceHistory,
  initializeResourceHistorySchema,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  nextRevisionAfterHistory,
  pruneHistoryBefore,
  purgeResourceHistory,
  type ResourceHistoryRecord
} from "#utils/persistence/resourceHistory.js";
import type { GeneralFile, GeneralFileFilter } from "../domain/model.js";
import type { GeneralFileStore } from "../ports/repository.js";

const tablePrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

function createSchema(db: DB, p: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gf_${p}_files (
      id                  TEXT PRIMARY KEY
        CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),
      kind                TEXT NOT NULL
        CHECK (kind IN ('general::file::text', 'general::file::other')),
      file_name           TEXT NOT NULL
        CHECK (length(trim(file_name)) > 0),
      extension           TEXT NOT NULL,
      content             TEXT NOT NULL,
      byte_size           INTEGER NOT NULL
        CHECK (byte_size >= 0),
      content_hash        TEXT NOT NULL
        CHECK (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*'),
      revision            INTEGER NOT NULL
        CHECK (revision >= 1),
      knowledge_source_id TEXT,
      replaces_id         TEXT,
      replaced_by_id      TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      CHECK (byte_size = length(CAST(content AS BLOB))),
      CHECK (content_hash = id)
    );

    CREATE INDEX IF NOT EXISTS gf_${p}_files_kind_created
      ON gf_${p}_files(kind, created_at DESC);

    CREATE INDEX IF NOT EXISTS gf_${p}_files_extension
      ON gf_${p}_files(extension);

    CREATE INDEX IF NOT EXISTS gf_${p}_files_file_name
      ON gf_${p}_files(file_name COLLATE NOCASE);

    CREATE UNIQUE INDEX IF NOT EXISTS gf_${p}_files_active_content
      ON gf_${p}_files(content_hash);
  `);
  initializeResourceHistorySchema(db, `gf_${p}_history`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFile(row: Record<string, any>): GeneralFile {
  return {
    id: row.id as string,
    kind: row.kind as GeneralFile["kind"],
    fileName: row.file_name as string,
    extension: row.extension as string,
    content: row.content as string,
    byteSize: row.byte_size as number,
    contentHash: row.content_hash as string,
    revision: row.revision as number,
    knowledgeSourceId: (row.knowledge_source_id as string | null) ?? null,
    replacesId: (row.replaces_id as string | null) ?? undefined,
    replacedById: (row.replaced_by_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFileMeta(row: Record<string, any>): Omit<GeneralFile, "content"> {
  const file = rowToFile(row);
  const { content: _, ...meta } = file;
  return meta;
}

export class SQLiteGeneralFileStore implements GeneralFileStore {
  private readonly db: DB;
  private readonly p: string;
  private readonly historyTableName: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.p = tablePrefix(projectId);
    this.historyTableName = `gf_${this.p}_history`;
    createSchema(this.db, this.p);
    this.db.pragma("foreign_keys = ON");
  }

  getById(id: string): GeneralFile | undefined {
    const row = this.db
      .prepare(`SELECT * FROM gf_${this.p}_files WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToFile(row) : undefined;
  }

  getByHash(contentHash: string): GeneralFile | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM gf_${this.p}_files WHERE content_hash = ?`
      )
      .get(contentHash) as Record<string, unknown> | undefined;
    return row ? rowToFile(row) : undefined;
  }

  list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[] {
    let sql = `SELECT * FROM gf_${this.p}_files`;
    const params: unknown[] = [];

    if (filters && filters.length > 0) {
      const clauses: string[] = [];
      for (const f of filters) {
        switch (f.kind) {
          case "by-kind":
            clauses.push("kind = ?");
            params.push(f.value);
            break;
          case "by-extension":
            clauses.push("extension = ?");
            params.push(f.value);
            break;
          case "by-name-contains":
            clauses.push("file_name LIKE ?");
            params.push(`%${f.value}%`);
            break;
          case "by-name-starts-with":
            clauses.push("file_name LIKE ?");
            params.push(`${f.value}%`);
            break;
          case "by-name-ends-with":
            clauses.push("file_name LIKE ?");
            params.push(`%${f.value}`);
            break;
        }
      }
      if (clauses.length > 0) {
        sql += " WHERE " + clauses.join(" AND ");
      }
    }

    sql += " ORDER BY created_at DESC";

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToFileMeta);
  }

  insert(file: GeneralFile): void {
    this.db.prepare(`
      INSERT INTO gf_${this.p}_files
        (id, kind, file_name, extension, content, byte_size, content_hash,
         revision, knowledge_source_id, replaces_id, replaced_by_id,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      file.id,
      file.kind,
      file.fileName,
      file.extension,
      file.content,
      file.byteSize,
      file.contentHash,
      file.revision,
      file.knowledgeSourceId,
      file.replacesId ?? null,
      file.replacedById ?? null,
      file.createdAt,
      file.updatedAt,
    );
  }

  nextRevision(id: string): number {
    return nextRevisionAfterHistory(this.db, this.historyTableName, "general-file", id);
  }

  replace(previous: GeneralFile, replacement: GeneralFile, replacedAt: string): void {
    const upsertReplacement = this.db.prepare(`
      INSERT INTO gf_${this.p}_files
        (id, kind, file_name, extension, content, byte_size, content_hash,
         revision, knowledge_source_id, replaces_id, replaced_by_id,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      const previousRow = this.db.prepare(`
        SELECT * FROM gf_${this.p}_files WHERE id = ? AND revision = ?
      `).get(previous.id, previous.revision) as Record<string, unknown> | undefined;
      if (!previousRow) {
        throw new Error(`General file replacement lost its current source: ${previous.id}`);
      }
      upsertReplacement.run(
        replacement.id,
        replacement.kind,
        replacement.fileName,
        replacement.extension,
        replacement.content,
        replacement.byteSize,
        replacement.contentHash,
        replacement.revision,
        replacement.knowledgeSourceId,
        replacement.replacesId ?? null,
        replacement.replacedById ?? null,
        replacement.createdAt,
        replacement.updatedAt,
      );
      const snapshot = { ...rowToFile(previousRow), replacedById: replacement.id, updatedAt: replacedAt };
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: previous.id,
        revision: previous.revision,
        snapshot,
        recordedAt: replacedAt
      });
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: previous.id,
        revision: previous.revision + 1,
        recordedAt: replacedAt
      });
      this.db.prepare(`DELETE FROM gf_${this.p}_files WHERE id = ? AND revision = ?`)
        .run(previous.id, previous.revision);
    })();
  }

  linkReplacement(previous: GeneralFile, replacementId: string, replacedAt: string): void {
    this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM gf_${this.p}_files WHERE id = ? AND revision = ?
      `).get(previous.id, previous.revision) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`General file replacement lost its current source: ${previous.id}`);
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: previous.id,
        revision: previous.revision,
        snapshot: { ...rowToFile(row), replacedById: replacementId, updatedAt: replacedAt },
        recordedAt: replacedAt
      });
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: previous.id,
        revision: previous.revision + 1,
        recordedAt: replacedAt
      });
      this.db.prepare(`DELETE FROM gf_${this.p}_files WHERE id = ? AND revision = ?`)
        .run(previous.id, previous.revision);
    })();
  }

  delete(id: string, deletedAt: string): number | undefined {
    return this.db.transaction(() => {
      const row = this.db.prepare(`SELECT * FROM gf_${this.p}_files WHERE id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const current = rowToFile(row);
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: id,
        revision: current.revision,
        snapshot: current,
        recordedAt: deletedAt
      });
      const deletedRevision = current.revision + 1;
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "general-file",
        resourceId: id,
        revision: deletedRevision,
        recordedAt: deletedAt
      });
      this.db.prepare(`DELETE FROM gf_${this.p}_files WHERE id = ?`).run(id);
      return deletedRevision;
    })();
  }

  purge(id: string): "purged" | "current" | "missing" {
    if (this.getById(id)) return "current";
    return purgeResourceHistory(this.db, this.historyTableName, "general-file", id)
      ? "purged"
      : "missing";
  }

  history(id: string): ResourceHistoryRecord<GeneralFile>[] {
    return getResourceHistory<GeneralFile>(
      this.db,
      this.historyTableName,
      "general-file",
      id
    );
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.historyTableName,
      cutoff,
      (_kind, id) => Boolean(this.getById(id))
    );
  }

  purgeExpired(cutoff: string): number {
    let purged = 0;
    for (const resource of listExpiredDeletedResources(this.db, this.historyTableName, cutoff)) {
      if (!this.getById(resource.resourceId) && this.purge(resource.resourceId) === "purged") {
        purged += 1;
      }
    }
    return purged;
  }
}

// SQLite implementation of GeneralFileStore.
// Table prefix = SHA-256(projectId).slice(0,16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
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
      extension           TEXT NOT NULL
        CHECK (length(extension) > 0),
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
      deleted_at          TEXT,
      CHECK (byte_size = length(content)),
      CHECK (content_hash = id),
      FOREIGN KEY (replaces_id)
        REFERENCES gf_${p}_files(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      FOREIGN KEY (replaced_by_id)
        REFERENCES gf_${p}_files(id)
        ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS gf_${p}_files_kind_created
      ON gf_${p}_files(kind, deleted_at IS NULL, created_at DESC);

    CREATE INDEX IF NOT EXISTS gf_${p}_files_extension
      ON gf_${p}_files(extension, deleted_at IS NULL);

    CREATE INDEX IF NOT EXISTS gf_${p}_files_file_name
      ON gf_${p}_files(file_name COLLATE NOCASE, deleted_at IS NULL)
      WHERE deleted_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS gf_${p}_files_active_content
      ON gf_${p}_files(content_hash)
      WHERE deleted_at IS NULL;
  `);
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
    replacesId: row.replaces_id as string | undefined,
    replacedById: row.replaced_by_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | undefined,
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

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.p = tablePrefix(projectId);
    createSchema(this.db, this.p);
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
        `SELECT * FROM gf_${this.p}_files
         WHERE content_hash = ? AND deleted_at IS NULL`
      )
      .get(contentHash) as Record<string, unknown> | undefined;
    return row ? rowToFile(row) : undefined;
  }

  list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[] {
    let sql = `SELECT * FROM gf_${this.p}_files WHERE deleted_at IS NULL`;
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
        sql += " AND " + clauses.join(" AND ");
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
         created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      file.deletedAt ?? null,
    );
  }

  update(file: GeneralFile): void {
    this.db.prepare(`
      UPDATE gf_${this.p}_files
      SET kind = ?, file_name = ?, extension = ?, content = ?,
          byte_size = ?, content_hash = ?, revision = ?,
          knowledge_source_id = ?, replaces_id = ?, replaced_by_id = ?,
          updated_at = ?, deleted_at = ?
      WHERE id = ?
    `).run(
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
      file.updatedAt,
      file.deletedAt ?? null,
      file.id,
    );
  }

  softDelete(id: string, deletedAt: string): void {
    this.db
      .prepare(`UPDATE gf_${this.p}_files SET deleted_at = ? WHERE id = ?`)
      .run(deletedAt, id);
  }
}
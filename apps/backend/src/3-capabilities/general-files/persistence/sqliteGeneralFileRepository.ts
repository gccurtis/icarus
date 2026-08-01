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
      deleted_at          TEXT,
      CHECK (byte_size = length(CAST(content AS BLOB))),
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

/**
 * The first General Files schema counted characters instead of UTF-8 bytes and
 * rejected extensionless files. Rebuild only that early schema in place so
 * existing development databases do not keep the stale CHECK constraints.
 */
function ensureCurrentSchema(db: DB, p: string): void {
  const table = `gf_${p}_files`;
  const existing = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table) as { sql: string } | undefined;

  if (!existing) {
    createSchema(db, p);
    return;
  }

  const needsRebuild =
    existing.sql.includes("length(extension) > 0") ||
    existing.sql.includes("byte_size = length(content)");

  if (!needsRebuild) {
    createSchema(db, p);
    return;
  }

  const legacy = `${table}_legacy_schema`;
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`ALTER TABLE ${table} RENAME TO ${legacy}`);
      db.exec(`
        DROP INDEX IF EXISTS gf_${p}_files_kind_created;
        DROP INDEX IF EXISTS gf_${p}_files_extension;
        DROP INDEX IF EXISTS gf_${p}_files_file_name;
        DROP INDEX IF EXISTS gf_${p}_files_active_content;
      `);
      createSchema(db, p);
      db.exec(`
        INSERT INTO ${table}
          (id, kind, file_name, extension, content, byte_size, content_hash,
           revision, knowledge_source_id, replaces_id, replaced_by_id,
           created_at, updated_at, deleted_at)
        SELECT
          id, kind, file_name, extension, content, byte_size, content_hash,
          revision, knowledge_source_id, replaces_id, replaced_by_id,
          created_at, updated_at, deleted_at
        FROM ${legacy};
        DROP TABLE ${legacy};
      `);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
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
    deletedAt: (row.deleted_at as string | null) ?? undefined,
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
    this.p = tablePrefix(projectId);
    ensureCurrentSchema(this.db, this.p);
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

  replace(previous: GeneralFile, replacement: GeneralFile, replacedAt: string): void {
    const upsertReplacement = this.db.prepare(`
      INSERT INTO gf_${this.p}_files
        (id, kind, file_name, extension, content, byte_size, content_hash,
         revision, knowledge_source_id, replaces_id, replaced_by_id,
         created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        file_name = excluded.file_name,
        extension = excluded.extension,
        content = excluded.content,
        byte_size = excluded.byte_size,
        content_hash = excluded.content_hash,
        revision = excluded.revision,
        knowledge_source_id = excluded.knowledge_source_id,
        replaces_id = excluded.replaces_id,
        replaced_by_id = excluded.replaced_by_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = NULL
    `);
    const retirePrevious = this.db.prepare(`
      UPDATE gf_${this.p}_files
      SET replaced_by_id = ?, updated_at = ?, deleted_at = ?
      WHERE id = ? AND revision = ? AND deleted_at IS NULL
    `);

    this.db.transaction(() => {
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
      const result = retirePrevious.run(
        replacement.id,
        replacedAt,
        replacedAt,
        previous.id,
        previous.revision,
      );
      if (result.changes !== 1) {
        throw new Error(`General file replacement lost its active source: ${previous.id}`);
      }
    })();
  }

  linkReplacement(previous: GeneralFile, replacementId: string, replacedAt: string): void {
    const result = this.db.prepare(`
      UPDATE gf_${this.p}_files
      SET replaced_by_id = ?, updated_at = ?, deleted_at = ?
      WHERE id = ? AND revision = ? AND deleted_at IS NULL
    `).run(replacementId, replacedAt, replacedAt, previous.id, previous.revision);
    if (result.changes !== 1) {
      throw new Error(`General file replacement lost its active source: ${previous.id}`);
    }
  }

  softDelete(id: string, deletedAt: string): void {
    this.db
      .prepare(`UPDATE gf_${this.p}_files SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(deletedAt, deletedAt, id);
  }
}

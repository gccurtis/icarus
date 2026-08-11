import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type {
  FrontierEntry,
  KnowledgeNode,
  KnowledgeWindow,
  SourceRecord,
  StoredLevelIndex
} from "#capabilities/knowledge/types.js";
import type { KnowledgeStore } from "#capabilities/knowledge/store.js";

// ─── Table naming ─────────────────────────────────────────────────────────────

/** 16-hex-char prefix derived from SHA-256(projectId). */
const tablePrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

// ─── Schema ───────────────────────────────────────────────────────────────────

function createSchema(db: DB, prefix: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kn_${prefix}_sources (
      source_id   TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      revision    TEXT NOT NULL DEFAULT '',
      window_count INTEGER NOT NULL DEFAULT 0,
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      added_at    TEXT NOT NULL,
      synced_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kn_${prefix}_windows (
      id          TEXT PRIMARY KEY,
      source_id   TEXT NOT NULL,
      label       TEXT NOT NULL,
      ordinal     INTEGER NOT NULL,
      start_byte  INTEGER NOT NULL,
      end_byte    INTEGER NOT NULL,
      text        TEXT NOT NULL,
      embedding   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS kn_${prefix}_windows_source
      ON kn_${prefix}_windows(source_id);

    CREATE TABLE IF NOT EXISTS kn_${prefix}_nodes (
      id          TEXT PRIMARY KEY,
      source_id   TEXT,
      level       INTEGER NOT NULL,
      centroid    TEXT NOT NULL,
      count       INTEGER NOT NULL,
      cohesion    REAL NOT NULL,
      member_ids  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS kn_${prefix}_nodes_source
      ON kn_${prefix}_nodes(source_id);

    CREATE TABLE IF NOT EXISTS kn_${prefix}_frontier (
      id          TEXT PRIMARY KEY,
      vector      TEXT NOT NULL,
      is_window   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kn_${prefix}_level_indices (
      level       INTEGER PRIMARY KEY,
      data        TEXT NOT NULL
    );
  `);
}

// ─── Serialization helpers ────────────────────────────────────────────────────

const serializeVec = (v: number[]): string => JSON.stringify(v);
const deserializeVec = (s: string): number[] => JSON.parse(s) as number[];
const serializeIds = (ids: string[]): string => JSON.stringify(ids);
const deserializeIds = (s: string): string[] => JSON.parse(s) as string[];

// ─── SQLiteKnowledgeStore ─────────────────────────────────────────────────────

export class SQLiteKnowledgeStore implements KnowledgeStore {
  private readonly db: DB;
  private readonly p: string; // prefix

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.p = tablePrefix(projectId);
    createSchema(this.db, this.p);
  }

  // ── Source registry ────────────────────────────────────────────────────────

  async getSource(sourceId: string): Promise<SourceRecord | undefined> {
    const row = this.db
      .prepare<[string], RawSource>(
        `SELECT * FROM kn_${this.p}_sources WHERE source_id = ?`
      )
      .get(sourceId);
    return row ? rowToSource(row) : undefined;
  }

  async putSource(record: SourceRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO kn_${this.p}_sources
           (source_id, label, revision, window_count, size_bytes, added_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET
           label        = excluded.label,
           revision     = excluded.revision,
           window_count = excluded.window_count,
           size_bytes   = excluded.size_bytes,
           added_at     = excluded.added_at,
           synced_at    = excluded.synced_at`
      )
      .run(
        record.sourceId,
        record.label,
        record.revision,
        record.windowCount,
        record.sizeBytes,
        record.addedAt.toISOString(),
        record.syncedAt.toISOString()
      );
  }

  async deleteSource(sourceId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM kn_${this.p}_sources WHERE source_id = ?`)
      .run(sourceId);
  }

  async listSources(): Promise<SourceRecord[]> {
    const rows = this.db
      .prepare<[], RawSource>(`SELECT * FROM kn_${this.p}_sources ORDER BY added_at ASC`)
      .all();
    return rows.map(rowToSource);
  }

  // ── Windows ────────────────────────────────────────────────────────────────

  async getWindows(ids: string[]): Promise<KnowledgeWindow[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare<string[], RawWindow>(
        `SELECT * FROM kn_${this.p}_windows WHERE id IN (${placeholders})`
      )
      .all(...ids);
    return rows.map(rowToWindow);
  }

  async putWindows(windows: KnowledgeWindow[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO kn_${this.p}_windows
         (id, source_id, label, ordinal, start_byte, end_byte, text, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_id = excluded.source_id,
         label     = excluded.label,
         ordinal   = excluded.ordinal,
         start_byte = excluded.start_byte,
         end_byte  = excluded.end_byte,
         text      = excluded.text,
         embedding = excluded.embedding`
    );
    const bulk = this.db.transaction((wins: KnowledgeWindow[]) => {
      for (const w of wins) {
        insert.run(
          w.id,
          w.sourceId,
          w.label,
          w.ordinal,
          w.start,
          w.end,
          w.text,
          serializeVec(w.embedding)
        );
      }
    });
    bulk(windows);
  }

  async deleteWindowsForSource(sourceId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM kn_${this.p}_windows WHERE source_id = ?`)
      .run(sourceId);
  }

  // ── Lattice nodes ──────────────────────────────────────────────────────────

  async getNodes(ids: string[]): Promise<KnowledgeNode[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare<string[], RawNode>(
        `SELECT * FROM kn_${this.p}_nodes WHERE id IN (${placeholders})`
      )
      .all(...ids);
    return rows.map(rowToNode);
  }

  async putNodes(nodes: KnowledgeNode[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO kn_${this.p}_nodes
         (id, source_id, level, centroid, count, cohesion, member_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_id  = excluded.source_id,
         level      = excluded.level,
         centroid   = excluded.centroid,
         count      = excluded.count,
         cohesion   = excluded.cohesion,
         member_ids = excluded.member_ids`
    );
    const bulk = this.db.transaction((ns: KnowledgeNode[]) => {
      for (const n of ns) {
        insert.run(
          n.id,
          n.sourceId ?? null,
          n.level,
          serializeVec(n.centroid),
          n.count,
          n.cohesion,
          serializeIds(n.memberIds)
        );
      }
    });
    bulk(nodes);
  }

  async deleteNodesForSource(sourceId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM kn_${this.p}_nodes WHERE source_id = ?`)
      .run(sourceId);
  }

  async deleteCorpusNodes(): Promise<void> {
    this.db
      .prepare(`DELETE FROM kn_${this.p}_nodes WHERE source_id IS NULL`)
      .run();
  }

  async getSourceNodeIds(sourceId: string): Promise<string[]> {
    const rows = this.db
      .prepare<[string], { id: string }>(
        `SELECT id FROM kn_${this.p}_nodes WHERE source_id = ?`
      )
      .all(sourceId);
    return rows.map((r) => r.id);
  }

  // ── Corpus frontier ────────────────────────────────────────────────────────

  async getFrontier(): Promise<FrontierEntry[]> {
    const rows = this.db
      .prepare<[], RawFrontier>(`SELECT * FROM kn_${this.p}_frontier`)
      .all();
    return rows.map((r) => ({
      id: r.id,
      vector: deserializeVec(r.vector),
      isWindow: r.is_window === 1
    }));
  }

  async putFrontier(entries: FrontierEntry[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO kn_${this.p}_frontier (id, vector, is_window)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         vector    = excluded.vector,
         is_window = excluded.is_window`
    );
    const replace = this.db.transaction((es: FrontierEntry[]) => {
      this.db.prepare(`DELETE FROM kn_${this.p}_frontier`).run();
      for (const e of es) {
        insert.run(e.id, serializeVec(e.vector), e.isWindow ? 1 : 0);
      }
    });
    replace(entries);
  }

  // ── IVF level index ────────────────────────────────────────────────────────

  async getLevelIndex(level: number): Promise<StoredLevelIndex | undefined> {
    const row = this.db
      .prepare<[number], { data: string }>(
        `SELECT data FROM kn_${this.p}_level_indices WHERE level = ?`
      )
      .get(level);
    if (!row) return undefined;
    return JSON.parse(row.data) as StoredLevelIndex;
  }

  async putLevelIndex(index: StoredLevelIndex): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO kn_${this.p}_level_indices (level, data)
         VALUES (?, ?)
         ON CONFLICT(level) DO UPDATE SET data = excluded.data`
      )
      .run(index.level, JSON.stringify(index));
  }

  async deleteLevelIndex(): Promise<void> {
    this.db.prepare(`DELETE FROM kn_${this.p}_level_indices`).run();
  }

  /** Close the underlying database connection. */
  close(): void {
    this.db.close();
  }
}

// ─── Row types ─────────────────────────────────────────────────────────────────

interface RawSource {
  source_id: string;
  label: string;
  revision: string;
  window_count: number;
  size_bytes: number;
  added_at: string;
  synced_at: string;
}

interface RawWindow {
  id: string;
  source_id: string;
  label: string;
  ordinal: number;
  start_byte: number;
  end_byte: number;
  text: string;
  embedding: string;
}

interface RawNode {
  id: string;
  source_id: string | null;
  level: number;
  centroid: string;
  count: number;
  cohesion: number;
  member_ids: string;
}

interface RawFrontier {
  id: string;
  vector: string;
  is_window: number;
}

// ─── Row converters ───────────────────────────────────────────────────────────

const rowToSource = (r: RawSource): SourceRecord => ({
  sourceId: r.source_id,
  label: r.label,
  revision: r.revision,
  windowCount: r.window_count,
  sizeBytes: r.size_bytes,
  addedAt: new Date(r.added_at),
  syncedAt: new Date(r.synced_at)
});

const rowToWindow = (r: RawWindow): KnowledgeWindow => ({
  id: r.id,
  sourceId: r.source_id,
  label: r.label,
  ordinal: r.ordinal,
  start: r.start_byte,
  end: r.end_byte,
  text: r.text,
  embedding: deserializeVec(r.embedding)
});

const rowToNode = (r: RawNode): KnowledgeNode => ({
  id: r.id,
  sourceId: r.source_id ?? undefined,
  level: r.level,
  centroid: deserializeVec(r.centroid),
  count: r.count,
  cohesion: r.cohesion,
  memberIds: deserializeIds(r.member_ids)
});

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import type { ContextEntry, PersonaRecord } from "../domain/model.js";
import type { PersonaStore } from "../ports/personaStore.js";
import {
  createPersonaTableNames,
  initializePersonaSchema,
  type PersonaTableNames
} from "./sqliteSchema.js";

const rowToRecord = (row: Record<string, unknown>): PersonaRecord => {
  const contextJson = row.context_json as string | null;
  const context = contextJson
    ? (JSON.parse(contextJson) as ContextEntry)
    : undefined;
  const wrapperId = (row.context_wrapper_id as string | null) ?? undefined;
  const wrapperRevision = (row.context_wrapper_revision as number | null) ?? undefined;

  return {
    id: row.id as string,
    displayName: row.display_name as string,
    description: row.description as string,
    definition: {
      focus: row.focus as string,
      background: row.background as string,
      approach: row.approach as string,
      outputPreferences: row.output_preferences as string,
      verification: row.verification as string,
      ...(context ? { context } : {})
    },
    ...(wrapperId ? { contextWrapperId: wrapperId } : {}),
    ...(wrapperRevision !== undefined ? { contextWrapperRevision: wrapperRevision } : {}),
    revision: row.revision as number,
    definitionDigest: row.definition_digest as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    ...(row.deleted_at ? { deletedAt: row.deleted_at as string } : {})
  };
};

export class SQLitePersonaStore implements PersonaStore {
  private readonly db: DatabaseConnection;
  private readonly tables: PersonaTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createPersonaTableNames(projectId);
    initializePersonaSchema(this.db, this.tables);
  }

  async get(id: string): Promise<PersonaRecord | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.personas} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  async getByName(displayName: string): Promise<PersonaRecord | undefined> {
    const row = this.db
      .prepare(
        `SELECT * FROM ${this.tables.personas}
         WHERE display_name = ? COLLATE NOCASE AND deleted_at IS NULL`
      )
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  async list(): Promise<PersonaRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM ${this.tables.personas}
         WHERE deleted_at IS NULL
         ORDER BY display_name COLLATE NOCASE, id`
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }

  async countLive(): Promise<number> {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${this.tables.personas} WHERE deleted_at IS NULL`)
      .get() as { count: number };
    return row.count;
  }

  async insert(record: PersonaRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO ${this.tables.personas}
           (id, display_name, description, focus, background, approach,
            output_preferences, verification, context_json, context_wrapper_id,
            context_wrapper_revision, definition_digest, revision,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.displayName,
        record.description,
        record.definition.focus,
        record.definition.background,
        record.definition.approach,
        record.definition.outputPreferences,
        record.definition.verification,
        record.definition.context ? JSON.stringify(record.definition.context) : null,
        record.contextWrapperId ?? null,
        record.contextWrapperRevision ?? null,
        record.definitionDigest,
        record.revision,
        record.createdAt,
        record.updatedAt,
        record.deletedAt ?? null
      );
  }

  async update(record: PersonaRecord, expectedRevision: number): Promise<boolean> {
    const result = this.db
      .prepare(
        `UPDATE ${this.tables.personas}
         SET display_name = ?, description = ?, focus = ?, background = ?, approach = ?,
             output_preferences = ?, verification = ?, context_json = ?,
             context_wrapper_id = ?, context_wrapper_revision = ?,
             definition_digest = ?, revision = ?, updated_at = ?
         WHERE id = ? AND revision = ? AND deleted_at IS NULL`
      )
      .run(
        record.displayName,
        record.description,
        record.definition.focus,
        record.definition.background,
        record.definition.approach,
        record.definition.outputPreferences,
        record.definition.verification,
        record.definition.context ? JSON.stringify(record.definition.context) : null,
        record.contextWrapperId ?? null,
        record.contextWrapperRevision ?? null,
        record.definitionDigest,
        record.revision,
        record.updatedAt,
        record.id,
        expectedRevision
      );
    return result.changes === 1;
  }

  async softDelete(id: string, expectedRevision: number, deletedAt: string): Promise<boolean> {
    const result = this.db
      .prepare(
        `UPDATE ${this.tables.personas}
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND revision = ? AND deleted_at IS NULL`
      )
      .run(deletedAt, deletedAt, id, expectedRevision);
    return result.changes === 1;
  }
}

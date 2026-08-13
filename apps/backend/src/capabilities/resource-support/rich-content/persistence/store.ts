import { sql, type Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import {
  currentAtoms,
  storedRawContent,
  type StoredAtom,
  type StoredRawContent
} from "#rich-content/persistence/stored-types.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type { RawContent } from "#rich-content/types/raw-content.js";
import "#rich-content/persistence/schema.js";

export interface RichContentStore {
  initialize(): Promise<void>;
  create(content: RawContent): Promise<void>;
  find(id: RichContentId): Promise<RawContent | undefined>;
  compareAndSwap(expectedVersion: number, content: RawContent): Promise<boolean>;
  replaceOneWithTwo(
    original: { id: RichContentId; expectedVersion: number },
    left: RawContent,
    right: RawContent
  ): Promise<boolean>;
  replaceManyWithOne(
    originals: readonly { id: RichContentId; expectedVersion: number }[],
    replacement: RawContent
  ): Promise<boolean>;
}

class CasConflict extends Error {}

const insertValue = (content: RawContent) => ({
  id: content.id,
  revision: content.version,
  raw_content: JSON.stringify(storedRawContent(content))
});

export class PGliteRichContentStore implements RichContentStore {
  constructor(private readonly database: Kysely<BackendDatabase>) {}

  async initialize(): Promise<void> {
    await this.database.schema
      .createTable("rich_content")
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("revision", "integer", (column) => column.notNull())
      .addColumn("raw_content", "jsonb", (column) => column.notNull())
      .addColumn("updated_at", "timestamptz", (column) =>
        column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
      )
      .execute();
  }

  async create(content: RawContent): Promise<void> {
    await this.database
      .insertInto("rich_content")
      .values(insertValue(content))
      .executeTakeFirstOrThrow();
  }

  async find(id: RichContentId): Promise<RawContent | undefined> {
    const row = await this.database
      .selectFrom("rich_content")
      .select(["id", "revision", "raw_content"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return undefined;

    const state = row.raw_content as StoredRawContent;
    return {
      id: row.id,
      version: row.revision,
      atoms: currentAtoms(state.atoms as readonly StoredAtom[]),
      marks: state.marks
    };
  }

  async compareAndSwap(
    expectedVersion: number,
    content: RawContent
  ): Promise<boolean> {
    if (content.version !== expectedVersion + 1) {
      throw new Error("Rich Content CAS must advance the revision by exactly one");
    }
    const result = await this.database
      .updateTable("rich_content")
      .set({
        revision: content.version,
        raw_content: JSON.stringify(storedRawContent(content)),
        updated_at: new Date()
      })
      .where("id", "=", content.id)
      .where("revision", "=", expectedVersion)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async replaceOneWithTwo(
    original: { id: RichContentId; expectedVersion: number },
    left: RawContent,
    right: RawContent
  ): Promise<boolean> {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const deleted = await transaction
          .deleteFrom("rich_content")
          .where("id", "=", original.id)
          .where("revision", "=", original.expectedVersion)
          .executeTakeFirst();
        if (deleted.numDeletedRows !== 1n) throw new CasConflict();
        await transaction
          .insertInto("rich_content")
          .values([insertValue(left), insertValue(right)])
          .execute();
        return true;
      });
    } catch (error) {
      if (error instanceof CasConflict) return false;
      throw error;
    }
  }

  async replaceManyWithOne(
    originals: readonly { id: RichContentId; expectedVersion: number }[],
    replacement: RawContent
  ): Promise<boolean> {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        for (const original of originals) {
          const deleted = await transaction
            .deleteFrom("rich_content")
            .where("id", "=", original.id)
            .where("revision", "=", original.expectedVersion)
            .executeTakeFirst();
          if (deleted.numDeletedRows !== 1n) throw new CasConflict();
        }
        await transaction
          .insertInto("rich_content")
          .values(insertValue(replacement))
          .execute();
        return true;
      });
    } catch (error) {
      if (error instanceof CasConflict) return false;
      throw error;
    }
  }
}

import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import {
  currentNamedVariable,
  storedNamedVariable
} from "#name-manager/persistence/stored-types.js";
import type { TableType } from "#name-manager/types/schema.js";
import type { DataValue } from "#name-manager/types/values.js";
import type { NamedVariable } from "#name-manager/types/variables.js";
import "#name-manager/persistence/schema.js";

/** The persistence operations Name Manager's runtime procedures require. */
export interface NameManagerStore {
  initialize(): Promise<void>;
  find(nameKey: string): Promise<NamedVariable | undefined>;
  create(nameKey: string, variable: NamedVariable): Promise<boolean>;
  list(): Promise<readonly NamedVariable[]>;
}

type SelectedVariable = {
  name: string;
  declared_type: TableType;
  value: DataValue;
};

const currentVariable = (row: SelectedVariable): NamedVariable =>
  currentNamedVariable({
    name: row.name,
    declaredType: row.declared_type,
    value: row.value
  });

/** A project-bound store over the shared backend database. */
export class PGliteNameManagerStore implements NameManagerStore {
  constructor(
    private readonly database: Kysely<BackendDatabase>,
    private readonly projectId: string
  ) {}

  async initialize(): Promise<void> {
    await this.database.schema
      .createTable("name_manager_variables")
      .ifNotExists()
      .addColumn("project_id", "text", (column) => column.notNull())
      .addColumn("name_key", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("declared_type", "jsonb", (column) => column.notNull())
      .addColumn("value", "jsonb", (column) => column.notNull())
      .addColumn("definition_order", "integer", (column) =>
        column.generatedAlwaysAsIdentity().notNull()
      )
      .addPrimaryKeyConstraint("name_manager_variables_primary", [
        "project_id",
        "name_key"
      ])
      .execute();

    await this.database.schema
      .createIndex("name_manager_variables_project_order")
      .ifNotExists()
      .on("name_manager_variables")
      .columns(["project_id", "definition_order"])
      .execute();
  }

  async find(nameKey: string): Promise<NamedVariable | undefined> {
    const row = await this.database
      .selectFrom("name_manager_variables")
      .select(["name", "declared_type", "value"])
      .where("project_id", "=", this.projectId)
      .where("name_key", "=", nameKey)
      .executeTakeFirst();

    return row ? currentVariable(row as SelectedVariable) : undefined;
  }

  async create(nameKey: string, variable: NamedVariable): Promise<boolean> {
    const stored = storedNamedVariable(variable);
    const inserted = await this.database
      .insertInto("name_manager_variables")
      .values({
        project_id: this.projectId,
        name_key: nameKey,
        name: stored.name,
        declared_type: JSON.stringify(stored.declaredType),
        value: JSON.stringify(stored.value)
      })
      .onConflict((conflict) =>
        conflict.columns(["project_id", "name_key"]).doNothing()
      )
      .returning("name_key")
      .executeTakeFirst();

    return inserted !== undefined;
  }

  async list(): Promise<readonly NamedVariable[]> {
    const rows = await this.database
      .selectFrom("name_manager_variables")
      .select(["name", "declared_type", "value"])
      .where("project_id", "=", this.projectId)
      .orderBy("definition_order", "asc")
      .execute();

    return rows.map((row) => currentVariable(row as SelectedVariable));
  }
}

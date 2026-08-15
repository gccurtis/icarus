import type { Kysely } from "kysely";
import type { Database } from "$model/server/index.server";
import "$name-manager/persistence/tables";

/**
 * The columns `tables.ts` declares, and the Postgres type each must have.
 *
 * Written out rather than derived: the point of the check below is to catch the
 * database and the declaration disagreeing, and a check derived from one of them
 * could only ever agree with itself.
 */
const COLUMNS: Readonly<Record<string, string>> = {
  name_key: "text",
  name: "text",
  declared_type: "jsonb",
  value: "jsonb",
  definition_order: "int4"
};

/**
 * Creates Name Manager's table, then verifies it.
 *
 * The verification is the point. `createTable().ifNotExists()` creates when
 * absent and does nothing when present, so the first added column silently
 * succeeds against an outdated database and fails later at query time, far from
 * the cause. Introspecting afterwards turns that into a startup failure naming
 * the difference.
 *
 * This is not a migration system and does not pretend to be one. It reports
 * drift; repairing it is still a person's job, and Kysely's `Migrator` is the
 * eventual answer. What it buys is that the report arrives at boot rather than
 * in the middle of someone's request.
 *
 * The index exists for `list`, which orders by `definition_order` on every call.
 * The backend indexed `(project_id, definition_order)`; with a database per
 * project the leading column has nothing left to distinguish.
 */
export const initializeNameManager = async (database: Kysely<Database>): Promise<void> => {
  await database.schema
    .createTable("name_manager_variables")
    .ifNotExists()
    .addColumn("name_key", "text", (column) => column.primaryKey())
    .addColumn("name", "text", (column) => column.notNull())
    .addColumn("declared_type", "jsonb", (column) => column.notNull())
    .addColumn("value", "jsonb", (column) => column.notNull())
    .addColumn("definition_order", "integer", (column) =>
      column.generatedAlwaysAsIdentity().notNull()
    )
    .execute();

  await database.schema
    .createIndex("name_manager_variables_definition_order")
    .ifNotExists()
    .on("name_manager_variables")
    .column("definition_order")
    .execute();

  await verify(database);
};

const verify = async (database: Kysely<Database>): Promise<void> => {
  const table = (await database.introspection.getTables()).find(
    (candidate) => candidate.name === "name_manager_variables"
  );

  if (!table) {
    throw new Error("Table 'name_manager_variables' is missing after initialization");
  }

  const present = new Map(table.columns.map((column) => [column.name, column.dataType]));
  const drift: string[] = [];

  for (const [name, dataType] of Object.entries(COLUMNS)) {
    const actual = present.get(name);
    if (actual === undefined) drift.push(`missing column '${name}'`);
    else if (actual !== dataType) {
      drift.push(`column '${name}' is ${actual}, declared ${dataType}`);
    }
  }

  // An extra column is drift too, and the direction that is easiest to miss:
  // dropping a column from `tables.ts` leaves the database exactly as it was,
  // and every query keeps working until someone wonders what the column is for.
  for (const name of present.keys()) {
    if (!(name in COLUMNS)) drift.push(`unexpected column '${name}'`);
  }

  if (drift.length > 0) {
    throw new Error(
      `Table 'name_manager_variables' has drifted from tables.ts: ${drift.join("; ")}`
    );
  }
};

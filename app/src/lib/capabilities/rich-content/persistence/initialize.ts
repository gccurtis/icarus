import { sql, type Kysely } from "kysely";
import type { Database } from "$model/server/index.server";
import "$rich-content/persistence/tables";

/**
 * The columns `tables.ts` declares, and the Postgres type each must have.
 *
 * Written out rather than derived: the point of the check below is to catch the
 * database and the declaration disagreeing, and a check derived from one of them
 * could only ever agree with itself.
 */
const COLUMNS: Readonly<Record<string, string>> = {
  id: "text",
  revision: "int4",
  raw_content: "jsonb",
  updated_at: "timestamptz"
};

/**
 * Creates Rich Content's table, then verifies it.
 *
 * The verification is the point. `createTable().ifNotExists()` creates when
 * absent and does nothing when present, so the first added column silently
 * succeeds against an outdated database and fails later at query time, far from
 * the cause. Introspecting afterwards turns that into a startup failure naming
 * the difference.
 *
 * This is not a migration system and does not pretend to be one. It reports
 * drift; repairing it is still a person's job.
 */
export const initializeRichContent = async (database: Kysely<Database>): Promise<void> => {
  await database.schema
    .createTable("rich_content")
    .ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("revision", "integer", (column) => column.notNull())
    .addColumn("raw_content", "jsonb", (column) => column.notNull())
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await verify(database);
};

const verify = async (database: Kysely<Database>): Promise<void> => {
  const table = (await database.introspection.getTables()).find(
    (candidate) => candidate.name === "rich_content"
  );

  if (!table) {
    throw new Error("Table 'rich_content' is missing after initialization");
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
    throw new Error(`Table 'rich_content' has drifted from tables.ts: ${drift.join("; ")}`);
  }
};

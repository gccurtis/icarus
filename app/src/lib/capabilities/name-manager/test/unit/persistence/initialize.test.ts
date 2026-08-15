import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect, sql } from "kysely";
import { afterEach, test } from "vitest";
import type { Database } from "$model/server/persistence/types";
import { initializeNameManager } from "$name-manager/persistence/initialize";

/**
 * The drift check is the reason `initialize` verifies as well as creates, and it
 * is only worth having if it actually fires. These tests open their own
 * databases rather than using the shared fixture, because each one needs a table
 * in a *wrong* state — which the fixture exists to prevent.
 */
const open = async (): Promise<{ database: Kysely<Database>; close: () => Promise<void> }> => {
  const pglite = await PGlite.create();
  const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
  return {
    database,
    close: async () => {
      await database.destroy();
      if (!pglite.closed) await pglite.close();
    }
  };
};

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()!();
});

test("creates the table, and is safe to run again", async () => {
  const { database, close } = await open();
  closers.push(close);

  await initializeNameManager(database);
  await initializeNameManager(database);

  const rows = await database.selectFrom("name_manager_variables").selectAll().execute();
  assert.deepEqual(rows, []);
}, 30_000);

test("reports a missing column rather than failing at query time", async () => {
  // `createTable().ifNotExists()` does nothing when the table is present, so
  // without this check the first added column succeeds silently against an
  // outdated database and fails much later, far from the cause.
  const { database, close } = await open();
  closers.push(close);

  await sql`create table name_manager_variables (
    name_key text primary key,
    name text not null,
    declared_type jsonb not null,
    definition_order integer generated always as identity not null
  )`.execute(database);

  await assert.rejects(
    () => initializeNameManager(database),
    (error: unknown) => error instanceof Error && error.message.includes("missing column 'value'")
  );
}, 30_000);

test("reports an unexpected column, which is the direction easiest to miss", async () => {
  // Dropping a column from `tables.ts` leaves the database exactly as it was,
  // and every query keeps working until someone wonders what the column is for.
  const { database, close } = await open();
  closers.push(close);

  await initializeNameManager(database);
  await sql`alter table name_manager_variables add column project_id text`.execute(database);

  await assert.rejects(
    () => initializeNameManager(database),
    (error: unknown) =>
      error instanceof Error && error.message.includes("unexpected column 'project_id'")
  );
}, 30_000);

test("reports a column whose type has changed", async () => {
  const { database, close } = await open();
  closers.push(close);

  await sql`create table name_manager_variables (
    name_key text primary key,
    name text not null,
    declared_type jsonb not null,
    value text not null,
    definition_order integer generated always as identity not null
  )`.execute(database);

  await assert.rejects(
    () => initializeNameManager(database),
    (error: unknown) =>
      error instanceof Error && error.message.includes("column 'value' is text, declared jsonb")
  );
}, 30_000);

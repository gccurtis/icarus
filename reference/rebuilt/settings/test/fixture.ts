import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect, sql } from "kysely";
import { afterAll, beforeAll, beforeEach } from "vitest";
import type { Database } from "$model/server/persistence/types";
import type { Scope } from "$model/server/scope.server";
import { initializeSettings } from "$settings/persistence/initialize";
import { stub } from "$settings/test/stub";

/** A scope for a project, of the shape `resolveScope` would have produced. */
export const scopeFor = (projectId: string, userId = "tester"): Scope => ({
  projectId,
  userId
});

/**
 * Opens an in-memory database per project and keeps it for the whole file.
 *
 * **Per file, not per test.** An in-memory PGlite costs roughly 750ms to stand
 * up — measured, not guessed — which is affordable once and ruinous forty times.
 * Tests are isolated by truncating between them instead, which is also closer to
 * what the code meets in production: a table that already exists.
 *
 * Running the real `initializeSettings` rather than hand-written DDL means the
 * drift check runs on every suite, so a `tables.ts` that disagrees with the DDL
 * fails here rather than at someone's next boot.
 */
export const installDatabases = (projectIds: readonly string[] = ["project-a"]): void => {
  const closers: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    for (const projectId of projectIds) {
      const pglite = await PGlite.create();
      const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
      await initializeSettings(database);
      stub.databases.set(projectId, database);
      closers.push(async () => {
        await database.destroy();
        // Kysely's PGlite driver closes the instance in destroy(); closing an
        // already-closed one throws, so this asks first.
        if (!pglite.closed) await pglite.close();
      });
    }
  }, 30_000);

  beforeEach(async () => {
    stub.records.length = 0;
    for (const database of stub.databases.values()) {
      await sql`truncate table settings`.execute(database);
    }
  });

  afterAll(async () => {
    for (const close of closers) await close();
    stub.databases.clear();
  });
};

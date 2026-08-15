import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect, sql } from "kysely";
import { afterAll, beforeAll, beforeEach } from "vitest";
import type { Database } from "$model/server/persistence/types";
import type { Scope } from "$model/server/scope.server";
import { initializeRichContent } from "$rich-content/persistence/initialize";
import { stub } from "$rich-content/test/stub";
import type { DisplayContent, DisplayRange } from "$rich-content/types/display-content";

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
 * Running the real `initializeRichContent` rather than hand-written DDL means the
 * drift check runs on every suite, so a `tables.ts` that disagrees with the DDL
 * fails here rather than at someone's next boot.
 */
export const installDatabases = (projectIds: readonly string[] = ["project-a"]): void => {
  const closers: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    for (const projectId of projectIds) {
      const pglite = await PGlite.create();
      const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
      await initializeRichContent(database);
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
      await sql`truncate table rich_content`.execute(database);
    }
  });

  afterAll(async () => {
    for (const close of closers) await close();
    stub.databases.clear();
  });
};

/**
 * The text of a projection, one string per line.
 *
 * Segments are split wherever formatting changes, so asserting on segment arrays
 * would couple a test to how many marks happen to overlap. What a reader sees is
 * the concatenation, and that is what most of these tests are about.
 */
export const linesOf = (content: DisplayContent): string[] =>
  content.lines.map((line) => line.segments.map(({ text }) => text).join(""));

/** The whole of one line, as a display range. */
export const wholeLine = (content: DisplayContent, lineIndex = 0): DisplayRange => {
  const line = content.lines[lineIndex];
  if (!line) throw new Error(`no line ${lineIndex} in this projection`);
  const first = line.segments[0];
  const last = line.segments.at(-1);
  if (!first || !last) throw new Error(`line ${lineIndex} has no segments`);
  return {
    start: { segmentId: first.id, offset: 0 },
    end: { segmentId: last.id, offset: last.text.length }
  };
};

/**
 * A display range over part of the first line, by character offsets within the
 * segment those offsets fall in.
 *
 * Only valid where the line is a single segment, which is true of freshly
 * created content — and every test using it creates its own.
 */
export const withinFirstSegment = (
  content: DisplayContent,
  start: number,
  end: number
): DisplayRange => {
  const segment = content.lines[0]?.segments[0];
  if (!segment) throw new Error("no first segment in this projection");
  return {
    start: { segmentId: segment.id, offset: start },
    end: { segmentId: segment.id, offset: end }
  };
};

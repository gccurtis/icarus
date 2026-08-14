import type { TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import type { Logger } from "#observability";
import type { BackendDatabase } from "#persistence";
import { PGliteRichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import { PersistedRichContentRuntime } from "#rich-content/runtime-objects/rich-content/definition.js";

/**
 * Counting ID factory. The runtime's own factory is UUID-backed, so tests that
 * assert on generated identity substitute this one — which is possible only
 * because the factory is an injected internal runtime object.
 */
export const deterministicIds = (): RichContentIdFactory => {
  const counts = { content: 0, atom: 0, mark: 0, list: 0 };
  return {
    contentId: () => `content-${++counts.content}`,
    atomId: () => `atom-${++counts.atom}`,
    markId: () => `mark-${++counts.mark}`,
    listId: () => `list-${++counts.list}`
  };
};

/**
 * A logger that records nothing. These tests assert content behavior, not
 * instrumentation, and a real logger would put a line on stdout for every
 * mutation the suite makes.
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

/** One in-memory PGlite database, store, and runtime per test. */
export const fixture = async (context: TestContext) => {
  const pglite = await PGlite.create();
  const database = new Kysely<BackendDatabase>({
    dialect: new PGliteDialect({ pglite })
  });
  const store = new PGliteRichContentStore(database);
  await store.initialize();
  const ids = deterministicIds();
  const runtime = new PersistedRichContentRuntime(store, ids, silentLogger);
  context.after(async () => database.destroy());
  return { database, ids, runtime, store };
};

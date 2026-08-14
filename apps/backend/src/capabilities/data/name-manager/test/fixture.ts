import type { TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import type { Logger } from "#observability";
import type { BackendDatabase } from "#persistence";
import { createNameManager, type NameManager } from "#name-manager";
import type { NameManagerStore } from "#name-manager/persistence/store.js";
import { PersistedNameManager } from "#name-manager/runtime-objects/name-manager/definition.js";
import type { NamedVariable } from "#name-manager/types/variables.js";

/**
 * A logger that records nothing.
 *
 * These tests assert Name Manager behavior, not instrumentation, and a real logger
 * would put a line on stdout for every call the suite makes. Instrumentation is
 * covered where it is written, in the runtime object's own tests.
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

/** Fast capability-local store for admission and instrumentation unit tests. */
export class MemoryNameManagerStore implements NameManagerStore {
  private readonly variables = new Map<string, NamedVariable>();

  async initialize(): Promise<void> {}

  async find(nameKey: string): Promise<NamedVariable | undefined> {
    const variable = this.variables.get(nameKey);
    return variable && structuredClone(variable);
  }

  async create(nameKey: string, variable: NamedVariable): Promise<boolean> {
    if (this.variables.has(nameKey)) return false;
    this.variables.set(nameKey, structuredClone(variable));
    return true;
  }

  async list(): Promise<readonly NamedVariable[]> {
    return [...this.variables.values()].map((variable) => structuredClone(variable));
  }
}

export const testNameManager = (logger: Logger = silentLogger): PersistedNameManager =>
  new PersistedNameManager(new MemoryNameManagerStore(), logger);

/** One in-memory PGlite database and project-bound runtime per test. */
export const persistentFixture = async (
  context: TestContext,
  projectId = "project-a"
) => {
  const pglite = await PGlite.create();
  const database = new Kysely<BackendDatabase>({
    dialect: new PGliteDialect({ pglite })
  });
  const runtimeFor = (project: string): Promise<NameManager> =>
    createNameManager(database, project, silentLogger);
  const runtime = await runtimeFor(projectId);
  context.after(async () => database.destroy());
  return { database, runtime, runtimeFor };
};

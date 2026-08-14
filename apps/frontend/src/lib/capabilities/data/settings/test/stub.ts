import type { Kysely } from "kysely";
import type { Database } from "$runtime/server/persistence/types";

/** One recorded log line, in the order `record` emitted it. */
export interface Recorded {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly data: unknown;
}

/**
 * What the stubbed server runtime hands back, mutable so a test can install its
 * databases after the mock has been registered.
 *
 * Keyed by project id rather than holding one database, because the property
 * worth proving about this capability is that two projects cannot see each
 * other — and a stub with a single database could not fail that test.
 */
export const stub = {
  databases: new Map<string, Kysely<Database>>(),
  records: [] as Recorded[]
};

/**
 * The replacement for `$runtime/server/index.server`.
 *
 * **One module is the whole test seam.** Procedures reach exactly two things
 * they do not receive as parameters — the project database and the logger — and
 * both come from this door, so substituting it lets every procedure run its real
 * code path with its real signature. No fake store, no injected factory, and
 * nothing in the capability that exists only for tests.
 */
export const serverStub = () => ({
  projectDatabase: async (projectId: string): Promise<Kysely<Database>> => {
    const database = stub.databases.get(projectId);
    if (!database) throw new Error(`no test database installed for project '${projectId}'`);
    return database;
  },

  serverRuntime: async () => ({
    logger: {
      debug: (message: string, data?: unknown) =>
        stub.records.push({ level: "debug", message, data }),
      info: (message: string, data?: unknown) =>
        stub.records.push({ level: "info", message, data }),
      warn: (message: string, data?: unknown) =>
        stub.records.push({ level: "warn", message, data }),
      error: (message: string, data?: unknown) =>
        stub.records.push({ level: "error", message, data })
    }
  })
});

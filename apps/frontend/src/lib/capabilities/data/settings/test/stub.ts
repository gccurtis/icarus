import type { Kysely } from "kysely";
import { errorFields } from "$model/server/observability/index.server";
import type { Database } from "$model/server/persistence/types";

/** One recorded log line, in the order `record` emitted it. */
export interface Recorded {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly data: unknown;
}

/**
 * What the stubbed server model hands back, mutable so a test can install its
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
 * The replacement for `$model/server/index.server`.
 *
 * **One module is the whole test seam.** Procedures reach exactly two things
 * they do not receive as parameters — the project database and the logger — and
 * both come from this door, so substituting it lets every procedure run its real
 * code path with its real signature. No fake store, no injected factory, and
 * nothing in the capability that exists only for tests.
 *
 * `errorFields` is passed through rather than reimplemented. It shapes what a
 * fault is recorded as, and a second copy here would let the assertions agree
 * with the stub while the real records changed underneath them.
 */
export const serverStub = () => ({
  errorFields,

  projectDatabase: async (projectId: string): Promise<Kysely<Database>> => {
    const database = stub.databases.get(projectId);
    if (!database) throw new Error(`no test database installed for project '${projectId}'`);
    return database;
  },

  // Synchronous, like the door it replaces: the graph is built once by
  // `hooks.server.ts`'s `init` hook, so by the time a procedure runs there is
  // nothing left to await.
  serverModel: () => ({
    observability: {
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
    }
  })
});

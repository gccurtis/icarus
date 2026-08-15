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
 * code path with its real signature.
 *
 * That replaces three injection points the backend's tests needed: a fake store,
 * a counting id factory, and a silent logger. The store is gone with the runtime
 * object, the logger is here, and identity is handled by mocking
 * `$rich-content/api/shared/ids` in the handful of tests where it is the point.
 */
export const serverStub = () => ({
  errorFields,

  projectDatabase: async (projectId: string): Promise<Kysely<Database>> => {
    const database = stub.databases.get(projectId);
    if (!database) throw new Error(`no test database installed for project '${projectId}'`);
    return database;
  },

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

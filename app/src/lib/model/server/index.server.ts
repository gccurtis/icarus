import type { Kysely } from "kysely";
import type { Database } from "$model/server/persistence/index.server";
import type { ServerModel } from "$model/server/types";
import { buildServerModel } from "$model/server/constructor.server";

export type { ServerModel } from "$model/server/types";
export type { Scope, Session } from "$model/server/scope.server";
export type { Configuration } from "$model/server/configuration/index.server";

/**
 * Re-exported so a capability records a failure without reaching past this door.
 *
 * `errorFields` is the shape every log line about a fault is written in, and it
 * belongs to observability. A caller that had to import it from there would be
 * holding two references to the server tree to write one line, and the second
 * one would be the only place the door was not the whole seam.
 */
export { errorFields } from "$model/server/observability/index.server";
export type { Logger } from "$model/server/observability/index.server";
export type { Database, ProjectDatabase } from "$model/server/persistence/index.server";

/**
 * The one graph, built once at startup.
 *
 * Safe as module state *because none of it is per-user*. Everything here is
 * process infrastructure; identity arrives per request as `Scope`.
 */
let instance: ServerModel | undefined;

/**
 * Once shutdown begins the graph is gone for good.
 *
 * A latch rather than clearing `instance`, because the two states have to be
 * told apart: the server drains in-flight requests for up to thirty seconds
 * after the signal and keep-alive connections keep delivering, so a call
 * arriving mid-drain has to hear "shutting down" rather than "not built yet".
 */
let closed = false;

/**
 * Builds the one graph. Called once by `hooks.server.ts`'s `init` hook, which
 * SvelteKit invokes before the server answers its first request.
 *
 * Building here rather than at module load means a configuration error is a
 * startup failure with a logger to report it, rather than a module-load failure
 * without one. Building here rather than on first request means there is exactly
 * one build, at a known moment — so there is no in-flight promise to cache, no
 * race between concurrent first callers, and no failed build to evict.
 */
export const initServerModel = async (): Promise<ServerModel> =>
  (instance = await buildServerModel());

export const serverModel = (): ServerModel => {
  if (closed) {
    throw new Error("The server model is shutting down and cannot be rebuilt");
  }
  if (!instance) {
    throw new Error(
      "The server model has not been built — hooks.server.ts init() builds it. " +
        "See src/lib/model/server/server.md."
    );
  }
  return instance;
};

/**
 * One project's database, for the capability procedure that asked.
 *
 * **The only scoped accessor there is, and the reason it is a call rather than
 * an import.** Configuration and the logger are one per process, so code that
 * needs them imports them; there is no `import { database }` that could be
 * correct, because which database depends on a `scope.projectId` known only when
 * the procedure runs.
 *
 * It lives here rather than in `persistence/` because that module exports a
 * constructor and the built instance is held by this file. An accessor inside
 * `persistence/` would have to reach back up to the composition root, which is a
 * cycle.
 *
 * A second scoped object — a per-project cache, a subscription fan-out — would
 * get its own accessor beside this one rather than joining a bundle that then
 * has to grow a field for everyone.
 */
export const projectDatabase = async (projectId: string): Promise<Kysely<Database>> => {
  const { database } = await serverModel().persistence.forProject(projectId);
  return database;
};

/** Closes the graph if one was built. Idempotent, and one-way. */
export const closeServerModel = async (): Promise<void> => {
  if (closed) return;
  closed = true;

  const model = instance;
  if (!model) return;

  // Cleared before closing, so a caller arriving mid-drain cannot be handed a
  // graph whose databases are already going away. The latch above is what tells
  // it "shutting down" rather than "not built yet".
  instance = undefined;
  await model.close();
};

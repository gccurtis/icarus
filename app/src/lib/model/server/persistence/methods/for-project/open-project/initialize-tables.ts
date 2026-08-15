import type { Kysely } from "kysely";
import type { Database, Initializer } from "$model/server/persistence/types";

/**
 * Runs every capability's initializer against a newly opened database, in the
 * order the composition root listed them.
 *
 * Sequential rather than concurrent, and that is the point of the list: order
 * matters the day one capability's tables reference another's, and a
 * `Promise.all` here would make that day's failure intermittent.
 *
 * A capability absent from the list has no tables however many it declares,
 * which surfaces as the first query against a table nobody created.
 */
export const initializeTables = async (
  database: Kysely<Database>,
  initializers: readonly Initializer[]
): Promise<void> => {
  for (const initialize of initializers) {
    await initialize(database);
  }
};

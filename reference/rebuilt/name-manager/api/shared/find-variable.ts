import type { Kysely } from "kysely";
import type { Database } from "$model/server/index.server";
import { currentVariable } from "$name-manager/persistence/stored-types";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Reads one declaration by its lookup key.
 *
 * Promoted to `shared/` because three functions run it — `define`, `get`, and
 * `require` — and they must agree on what "the same name" means. That agreement
 * is the invariant, not the query: if `get` and `define` disagreed about the key
 * form, `define` would admit a name `get` could never find.
 *
 * It takes the key rather than the name, because the caller has already run
 * `canonicalName` to reject an unusable name with the right code. Doing that
 * here as well would decide the shape of every caller's error message.
 *
 * The query carries no project predicate. A project is its own database, so the
 * database it is handed *is* the scope.
 */
export const findVariable = async (
  database: Kysely<Database>,
  nameKey: string
): Promise<NamedVariable | undefined> => {
  const row = await database
    .selectFrom("name_manager_variables")
    .select(["name", "declared_type", "value"])
    .where("name_key", "=", nameKey)
    .executeTakeFirst();

  return row && currentVariable(row);
};

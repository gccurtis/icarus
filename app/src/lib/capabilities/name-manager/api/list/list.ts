import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { record } from "$name-manager/api/shared/record";
import { currentVariable } from "$name-manager/persistence/stored-types";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Returns every declaration in the project's catalog, in definition order.
 *
 * Definition order rather than alphabetical: a catalog is read as a record of
 * what was declared and when, and later declarations often depend on earlier
 * ones. A caller that wants another order can sort what it receives, which it
 * cannot do if the original order was never preserved.
 *
 * No paging. A project's named variables are authored by hand and a catalog that
 * outgrows one response is a different problem than this signature.
 *
 * The query carries no project predicate — the database it opens *is* the
 * project.
 */
export const list = async (scope: Scope): Promise<readonly NamedVariable[]> =>
  // The count is recorded; no name and no value is. A list says nothing about
  // any one variable, and the number is what makes a slow call explicable.
  record("list", {}, async () => {
    const database = await projectDatabase(scope.projectId);

    const rows = await database
      .selectFrom("name_manager_variables")
      .select(["name", "declared_type", "value"])
      .orderBy("definition_order", "asc")
      .execute();

    // `currentVariable` clones each row at the storage boundary, so nothing here
    // shares an object graph with the driver.
    return rows.map(currentVariable);
  });

import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { NameManagerError } from "$name-manager/errors";
import { canonicalVariable } from "$name-manager/api/define/canonical-variable";
import { invalidValue, isRecord } from "$name-manager/api/define/value-guards";
import { copyVariable } from "$name-manager/api/define/copy-variable";
import { canonicalName, nameKey } from "$name-manager/api/shared/canonical-name";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { record } from "$name-manager/api/shared/record";
import { storedNamedVariable } from "$name-manager/persistence/stored-types";
import type { NamedVariable, NamedVariableInput } from "$name-manager/types/variables";

/**
 * Adds one declaration to the project's catalog.
 *
 * **The name conflict is decided before the type and value are admitted.** That
 * ordering is behavior, not an implementation detail: a redefinition attempt
 * reports `name-conflict` rather than whichever schema fault its payload happens
 * to carry, so someone re-running a definition they already made is told the
 * true reason instead of being sent to fix a type that was never the problem.
 *
 * There is no update form. A declaration is a statement about what a name means,
 * and changing it silently under readers who have already resolved it is a
 * different operation with different consequences — one this capability does not
 * offer yet rather than one it offers by accident.
 *
 * `scope` is derived server-side and is deliberately separate from the input.
 * The browser's payload has no slot for a project or a user, so a client cannot
 * name authority it does not have.
 */
export const define = async (
  scope: Scope,
  input: NamedVariableInput
): Promise<NamedVariable> =>
  // The name and the declared kind are recorded; the value is not. A name is an
  // identifier, and a value is whatever an author put in the catalog.
  record("define", { name: isRecord(input) ? input.name : undefined }, async () => {
    if (!isRecord(input)) return invalidValue("variable", "an object declaration");

    const name = canonicalName(input.name, "variable.name");
    const key = nameKey(name);
    const database = await projectDatabase(scope.projectId);

    if (await findVariable(database, key)) {
      throw new NameManagerError("name-conflict", `Variable name '${name}' is already defined`);
    }

    const variable = canonicalVariable(input);
    const stored = storedNamedVariable(variable);

    // `do nothing` and a returning check rather than a prior existence check
    // alone: two concurrent definitions of the same name both pass the read
    // above, and this is what makes exactly one of them win.
    const inserted = await database
      .insertInto("name_manager_variables")
      .values({
        name_key: key,
        name: stored.name,
        declared_type: JSON.stringify(stored.declaredType),
        value: JSON.stringify(stored.value)
      })
      .onConflict((conflict) => conflict.column("name_key").doNothing())
      .returning("name_key")
      .executeTakeFirst();

    if (!inserted) {
      throw new NameManagerError("name-conflict", `Variable name '${name}' is already defined`);
    }

    return copyVariable(variable);
  });

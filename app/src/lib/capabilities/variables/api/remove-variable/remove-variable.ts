import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { validateRemoveVariable } from "$capabilities/variables/api/remove-variable/validate-remove-variable";
import { sameName, variableRowsOf } from "$capabilities/variables/api/shared/rows";
import type { RemoveVariableResult } from "$capabilities/variables/types/variables";

export const removeVariable = async (input: unknown): Promise<RemoveVariableResult> => {
  const scope = await requireScope();
  const asked = validateRemoveVariable(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;

  const held = variableRowsOf(store, projectId).find((row) => sameName(row.name, asked.name));
  if (held === undefined) return { removed: false };

  store.remove(`variables.${held._id}`);
  return { removed: true };
};

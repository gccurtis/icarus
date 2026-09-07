import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { validateReadVariables } from "$capabilities/variables/api/read-variables/validate-read-variables";
import { recordOf, variableRowsOf } from "$capabilities/variables/api/shared/rows";
import type { ReadVariablesResult } from "$capabilities/variables/types/variables";

export const readVariables = async (input: unknown): Promise<ReadVariablesResult> => {
  const scope = await requireScope();
  validateReadVariables(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;

  return {
    variables: variableRowsOf(store, projectId)
      .map(recordOf)
      .sort((one, other) => one.name.localeCompare(other.name))
  };
};

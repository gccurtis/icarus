import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateCreate } from "$capabilities/store/api/create/validate-create";
import type { CreateResult } from "$capabilities/store/types/create";

export const create = async (input: unknown): Promise<CreateResult> => {
  await requireScope();

  const { table, fields } = validateCreate(input);
  return { id: serverModel().store.create(table, fields) };
};

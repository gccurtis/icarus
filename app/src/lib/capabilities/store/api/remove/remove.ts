import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRemove } from "$capabilities/store/api/remove/validate-remove";
import type { RemoveResult } from "$capabilities/store/types/remove";

export const remove = async (input: unknown): Promise<RemoveResult> => {
  await requireScope();

  const { path } = validateRemove(input);
  serverModel().store.remove(path);
  return { path };
};

import { serverModel } from "$runtime/server/start.server";

import { validateUpdate } from "$capabilities/store/api/update/validate-update";
import type { UpdateResult } from "$capabilities/store/types/update";

export const update = (input: unknown): UpdateResult => {
  const { path, value } = validateUpdate(input);
  serverModel().store.update(path, value);
  return { path };
};

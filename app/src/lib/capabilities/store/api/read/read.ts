import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRead } from "$capabilities/store/api/read/validate-read";
import { scopedRead } from "$capabilities/store/api/read/scoped-read";
import type { ReadResult } from "$capabilities/store/types/read";

export const read = async (input: unknown): Promise<ReadResult> => {
  const scope = await requireScope();

  const { path } = validateRead(input);
  return scopedRead(serverModel().store, path, scope);
};

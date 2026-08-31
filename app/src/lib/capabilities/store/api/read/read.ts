import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRead } from "$capabilities/store/api/read/validate-read";
import type { ReadResult } from "$capabilities/store/types/read";

export const read = async (input: unknown): Promise<ReadResult> => {
  await requireScope();

  const { path } = validateRead(input);
  return serverModel().store.read(path) ?? null;
};

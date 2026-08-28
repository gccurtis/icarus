import { serverModel } from "$runtime/server/start.server";

import { validateRead } from "$capabilities/store/api/read/validate-read";
import type { ReadResult } from "$capabilities/store/types/read";

export const read = (input: unknown): ReadResult => {
  const { path } = validateRead(input);
  return serverModel().store.read(path) ?? null;
};

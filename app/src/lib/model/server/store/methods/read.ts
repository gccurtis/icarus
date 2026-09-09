import { asPath, readAt, type Found } from "$representation/store/path";

import type { MutationState } from "$model/server/store/methods/shared/state";
import { rowsOf } from "$model/server/store/methods/shared/state";

export const read = (state: MutationState, path: string): Found | undefined => {
  const parsed = asPath(path);
  return readAt(rowsOf(state, parsed.table), parsed);
};

import { asPath, removedAt } from "$representation/store/path";

import type { MutationState } from "$model/server/store/methods/shared/state";
import { replaceRows, rowsOf } from "$model/server/store/methods/shared/state";

export const remove = (state: MutationState, path: string): void => {
  const parsed = asPath(path);
  replaceRows(state, parsed.table, removedAt(rowsOf(state, parsed.table), parsed));
};

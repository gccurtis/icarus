import { asPath, asStorable, writtenAt } from "$representation/store/path";

import type { MutationState } from "$model/server/store/methods/shared/state";
import { replaceRows, rowsOf } from "$model/server/store/methods/shared/state";

export const update = (state: MutationState, path: string, value: unknown): void => {
  const parsed = asPath(path);
  replaceRows(state, parsed.table, writtenAt(rowsOf(state, parsed.table), parsed, asStorable(value)));
};

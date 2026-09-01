import type { TabId } from "$representation/data/types/workspace/tab";
import type { TabListData } from "$model/client/tab-list/definition.svelte";

export const remove = (state: TabListData, id: TabId): number => {
  const at = state.records.findIndex((record) => record.id === id);
  if (at < 0) return -1;

  state.records.splice(at, 1);
  return at;
};

import type { TabId } from "$representation/data/types/workspace/tab";
import type { TabListData } from "$model/client/tab-list/definition.svelte";

export const activate = (state: TabListData, id: TabId): void => {
  if (state.records.some((record) => record.id === id)) state.activeId = id;
};

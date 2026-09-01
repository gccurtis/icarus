import type { TabRecord } from "$representation/data/types/views/tab";
import type { TabListData } from "$model/client/tab-list/definition.svelte";

const MINTED = /^t(\d+)$/;

export const add = (state: TabListData, record: TabRecord, at?: number): number => {
  const numbered = MINTED.exec(record.id);
  if (numbered) state.counter = Math.max(state.counter, Number(numbered[1]));

  const index =
    at === undefined ? state.records.length : Math.min(Math.max(at, 0), state.records.length);
  state.records.splice(index, 0, record);

  return index;
};

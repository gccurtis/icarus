import type { TabRecord, Target } from "$representation/data/types/views/tab";
import type { TabListData } from "$model/client/tab-list/definition.svelte";

export const mint = (state: TabListData, target: Target): TabRecord => {
  state.counter += 1;
  return {
    id: `t${state.counter}`,
    screen: target.screen,
    resourceId: target.resourceId
  };
};
